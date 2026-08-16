/**
 * YouCam (Perfect Corp) Skin Analysis client.
 *
 * Server-side only. The API key is a bearer credential with spend attached to
 * it, so it never leaves the server: the browser talks to our route handlers,
 * and only the server talks to YouCam.
 *
 * Three properties this client is built around:
 *
 *   Rate limits are real. The documented ceiling is 5 QPS and 250 requests per
 *   300 seconds per token. A capture session fires three frames at once, and a
 *   backfill fires far more, so requests are funnelled through a queue rather
 *   than trusting call sites to behave.
 *
 *   Units are finite. A hackathon account has 1,000 units and an analysis costs
 *   roughly 9-12 depending on how many concerns are requested. Spending them on
 *   a misconfigured loop is unrecoverable, so every analysis passes a budget
 *   guard first.
 *
 *   Uploads are a three-step dance. The file endpoint returns a presigned URL,
 *   the bytes go to that URL directly, and only then can a task reference the
 *   file id.
 */

import {
  YOUCAM_ERROR_CODES,
  type CreditResponse,
  type FeatureCostEntry,
  type FileUploadResponse,
  type SkinAnalysisOutput,
  type SkinAnalysisTaskResponse,
  type TaskCreatedResponse,
  type YouCamEnvelope,
} from "./types";

const DEFAULT_BASE = "https://yce-api-01.makeupar.com";

/** Documented ceiling is 5 QPS; we stay under it deliberately. */
const MIN_REQUEST_INTERVAL_MS = 240;

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 180_000;

/**
 * Entries the service appends to every analysis that are not skin concerns.
 * `resize_image` even carries a mask URL, so filtering by presence of a mask is
 * not sufficient.
 */
const NON_CONCERN_OUTPUTS = new Set(["all", "skin_age", "resize_image"]);

interface CreditBucket {
  amount?: number;
  expiry?: number;
  type?: string;
}

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly httpStatus?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "YouCamError";
  }

  /** A message safe and useful to show a user mid-capture. */
  get userMessage(): string {
    switch (this.code) {
      case YOUCAM_ERROR_CODES.NO_FACE:
        return "No face detected in that frame. Move closer and make sure your whole face is in view.";
      case YOUCAM_ERROR_CODES.FACE_TOO_SMALL:
        return "Your face fills too little of the frame. Move closer, so your head roughly fills the oval, and try again.";
      case YOUCAM_ERROR_CODES.FACE_ANGLE:
        return "Your head was turned or tilted too far for the analyser to read that frame. Face the camera straight on and keep your expression neutral: laughing or talking tips the head further than it feels like. Nothing was scored, so try that frame again.";
      case YOUCAM_ERROR_CODES.FILE_TOO_LARGE:
        return "That photo is too large. Assay captures below 10 MB.";
      case YOUCAM_ERROR_CODES.NSFW:
        return "That image was rejected by content screening. Try another frame.";
      case YOUCAM_ERROR_CODES.INVALID_PARAMS:
        return "Invalid analysis configuration. Standard and high-definition concerns cannot be mixed in one request.";
      case YOUCAM_ERROR_CODES.INVALID_TASK:
        return "That analysis expired before we could read it. Please recapture.";
      default:
        return this.message;
    }
  }
}

/**
 * Serialises outbound requests with a minimum spacing so three concurrent frame
 * uploads cannot trip the rate limiter. Retries 429 and 5xx with exponential
 * backoff.
 */
class RequestQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private lastDispatch = 0;

  run<T>(task: () => Promise<T>): Promise<T> {
    const scheduled = this.chain.then(async () => {
      const sinceLast = Date.now() - this.lastDispatch;
      if (sinceLast < MIN_REQUEST_INTERVAL_MS) {
        await sleep(MIN_REQUEST_INTERVAL_MS - sinceLast);
      }
      this.lastDispatch = Date.now();
      return task();
    });

    // Keep the chain alive even when a task rejects, otherwise one failure
    // would poison every queued request behind it.
    this.chain = scheduled.catch(() => undefined);
    return scheduled;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AnalysisResult {
  taskId: string;
  /** Concern id (as returned by the API) mapped to its scores. */
  scores: Record<string, SkinAnalysisOutput>;
  /** Units this analysis consumed, when the API reports it. */
  unitsSpent?: number;
}

export interface YouCamClientOptions {
  apiKey: string;
  baseUrl?: string;
  /**
   * Refuse to start an analysis when the remaining balance would fall below
   * this. Protects the study from being starved by development traffic.
   */
  reserveUnits?: number;
  fetchImpl?: typeof fetch;
}

export class YouCamClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly reserveUnits: number;
  private readonly queue = new RequestQueue();
  private readonly fetchImpl: typeof fetch;

  constructor(options: YouCamClientOptions) {
    if (!options.apiKey) {
      throw new YouCamError(
        "YOUCAM_API_KEY is not set. Add it to .env.local, see .env.example.",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.reserveUnits = options.reserveUnits ?? 0;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    attempt = 0,
  ): Promise<T> {
    const response = await this.queue.run(() =>
      this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      }),
    );

    // 429 and 5xx are transient. Back off and retry rather than losing a
    // capture the user has already sat through.
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const backoff = 2 ** attempt * 1000 + Math.floor(Math.random() * 250);
      await sleep(backoff);
      return this.request<T>(path, init, attempt + 1);
    }

    const text = await response.text();
    let payload: YouCamEnvelope<T>;
    try {
      payload = JSON.parse(text) as YouCamEnvelope<T>;
    } catch {
      throw new YouCamError(
        `YouCam returned a non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
        undefined,
        response.status,
        response.status >= 500,
      );
    }

    if (!response.ok || (payload.status && payload.status >= 400)) {
      const code = payload.error_code ?? payload.errorCode ?? payload.error;
      throw new YouCamError(
        payload.message ?? payload.error ?? `YouCam request failed: ${path}`,
        typeof code === "string" ? code : undefined,
        response.status,
        response.status === 429 || response.status >= 500,
      );
    }

    // The envelope key is not consistent across the API, and the published docs
    // only ever show `data`. Verified against the live service on 27 Jul 2026:
    //
    //   /s2s/v2.0/file/skin-analysis     -> data
    //   /s2s/v2.0/task/skin-analysis/... -> data
    //   /s2s/v2.0/credit/feature-cost    -> result
    //   /s2s/v1.0/client/credit          -> results  (an array)
    //
    // Reading only `data` silently yields undefined on the credit endpoints, so
    // every known key is tried in order.
    return (payload.data ?? payload.result ?? payload.results ?? payload) as T;
  }

  /**
   * Remaining units, summed across token buckets.
   *
   * The account holds several grants that expire independently: a hackathon
   * grant and a trial grant, for instance, and the endpoint returns them as a
   * list rather than a single figure. The spendable balance is their sum.
   */
  async getCreditBalance(): Promise<number | null> {
    const data = await this.request<CreditResponse | CreditBucket[]>(
      "/s2s/v1.0/client/credit",
      { method: "GET" },
    );

    if (Array.isArray(data)) {
      const total = data.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0);
      return Number.isFinite(total) ? total : null;
    }

    const value = data.credit ?? data.total;
    return typeof value === "number" ? value : null;
  }

  /**
   * Per-feature unit costs. Used to budget a study before spending anything,
   * and to show the user what a session will cost before they capture it.
   */
  async getFeatureCosts(): Promise<FeatureCostEntry[]> {
    const data = await this.request<
      { skus?: FeatureCostEntry[]; features?: FeatureCostEntry[] } | FeatureCostEntry[]
    >("/s2s/v2.0/credit/feature-cost", { method: "GET" });

    if (Array.isArray(data)) return data;
    // Live responses nest the list under `skus`; `features` is kept as a
    // fallback in case the documented shape appears on another deployment.
    return data.skus ?? data.features ?? [];
  }

  /**
   * Step one and two of the upload dance: reserve a file id, then PUT the bytes
   * to the presigned URL the API hands back.
   */
  async uploadImage(
    bytes: Uint8Array | ArrayBuffer,
    fileName: string,
    contentType: string,
  ): Promise<string> {
    const buffer = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;

    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new YouCamError(
        `Image is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB; the API limit is 10 MB.`,
        YOUCAM_ERROR_CODES.FILE_TOO_LARGE,
      );
    }

    const data = await this.request<FileUploadResponse>("/s2s/v2.0/file/skin-analysis", {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            content_type: contentType,
            file_name: fileName,
            file_size: buffer.byteLength,
          },
        ],
      }),
    });

    const target = data.files?.[0];
    const upload = target?.requests?.[0];
    if (!target || !upload) {
      throw new YouCamError("YouCam did not return an upload target for the file.");
    }

    const put = await this.queue.run(() =>
      this.fetchImpl(upload.url, {
        method: upload.method ?? "PUT",
        headers: upload.headers ?? { "Content-Type": contentType },
        // Copy into a fresh buffer so the body is a plain ArrayBuffer regardless
        // of how the caller allocated it.
        body: buffer.slice().buffer as ArrayBuffer,
      }),
    );

    if (!put.ok) {
      throw new YouCamError(
        `Presigned upload failed with HTTP ${put.status}.`,
        undefined,
        put.status,
        put.status >= 500,
      );
    }

    return target.file_id;
  }

  /** Step three: start the analysis task. */
  async startSkinAnalysis(fileId: string, concerns: readonly string[]): Promise<string> {
    if (concerns.length === 0) {
      throw new YouCamError("At least one concern must be requested.");
    }

    // The API rejects a request mixing standard and high-definition concerns,
    // and the resulting error is opaque. Catch it here where we can explain it.
    const hd = concerns.filter((c) => c.startsWith("hd_")).length;
    if (hd !== 0 && hd !== concerns.length) {
      throw new YouCamError(
        "Cannot mix SD and HD concerns in one request; choose one mode for the session.",
        YOUCAM_ERROR_CODES.INVALID_PARAMS,
      );
    }

    const data = await this.request<TaskCreatedResponse>("/s2s/v2.0/task/skin-analysis", {
      method: "POST",
      body: JSON.stringify({
        src_file_id: fileId,
        dst_actions: concerns,
        format: "json",
      }),
    });

    if (!data.task_id) {
      throw new YouCamError("YouCam did not return a task id.");
    }
    return data.task_id;
  }

  /** Step four: poll until the task resolves. */
  async awaitSkinAnalysis(taskId: string): Promise<AnalysisResult> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const data = await this.request<SkinAnalysisTaskResponse>(
        `/s2s/v2.0/task/skin-analysis/${encodeURIComponent(taskId)}`,
        { method: "GET" },
      );

      if (data.task_status === "error") {
        // The task endpoint reports the reason in `error` as a bare code string
        // and leaves `error_code` unset, which is the reverse of the upload
        // endpoints. Reading only `error_code` meant every documented failure
        // fell through the message map and put a raw identifier such as
        // error_large_face_angle in front of the person mid-capture.
        throw new YouCamError(
          data.error ?? "Skin analysis failed.",
          data.error_code ?? data.error,
        );
      }

      if (data.task_status === "success") {
        const outputs = data.results?.output ?? [];
        const scores: Record<string, SkinAnalysisOutput> = {};
        for (const output of outputs) {
          // Requesting six concerns returns nine entries: the service appends
          // `all`, `skin_age` and `resize_image`, which carry no ui_score and
          // are not concerns. Keeping them would put undefined scores into the
          // statistics.
          if (NON_CONCERN_OUTPUTS.has(output.type)) continue;
          if (typeof output.raw_score !== "number") continue;
          scores[output.type] = output;
        }
        return { taskId, scores };
      }

      await sleep(
        data.polling_interval ? data.polling_interval * 1000 : POLL_INTERVAL_MS,
      );
    }

    throw new YouCamError(
      `Skin analysis ${taskId} did not complete within ${POLL_TIMEOUT_MS / 1000}s.`,
      undefined,
      undefined,
      true,
    );
  }

  /**
   * Full analysis for one frame, with a budget guard in front of it.
   *
   * `estimatedCost` should come from `getFeatureCosts`; the guard is a
   * safeguard against a runaway loop draining the study's units, not an exact
   * accounting.
   */
  async analyzeFrame(options: {
    bytes: Uint8Array | ArrayBuffer;
    fileName: string;
    contentType: string;
    concerns: readonly string[];
    estimatedCost?: number;
    skipBudgetCheck?: boolean;
  }): Promise<AnalysisResult> {
    const { bytes, fileName, contentType, concerns, estimatedCost = 12 } = options;

    if (!options.skipBudgetCheck && this.reserveUnits > 0) {
      const balance = await this.getCreditBalance();
      if (balance !== null && balance - estimatedCost < this.reserveUnits) {
        throw new YouCamError(
          `Refusing to spend: ${balance} units remain and the reserve is ${this.reserveUnits}. ` +
            `Raise YOUCAM_RESERVE_UNITS or top up the account.`,
        );
      }
    }

    const fileId = await this.uploadImage(bytes, fileName, contentType);
    const taskId = await this.startSkinAnalysis(fileId, concerns);
    return this.awaitSkinAnalysis(taskId);
  }

  /**
   * Analyse the frames of one capture session.
   *
   * Frames run sequentially rather than in parallel: they are already spaced by
   * the request queue, and a serial run means a failure on frame three does not
   * orphan spend on frames one and two.
   */
  async analyzeSession(
    frames: Array<{ bytes: Uint8Array; fileName: string; contentType: string }>,
    concerns: readonly string[],
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    for (const frame of frames) {
      results.push(
        await this.analyzeFrame({
          ...frame,
          concerns,
          // The balance was checked before the first frame; re-checking per
          // frame would triple the request count for no benefit.
          skipBudgetCheck: results.length > 0,
        }),
      );
    }
    return results;
  }
}

/** Build a client from the server environment. */
/**
 * @param apiKey Optional caller-supplied key, used instead of the server's own.
 *   The hosted deployment runs on one finite hackathon balance, so a visitor who
 *   has their own key can spend theirs rather than be turned away once mine is
 *   gone. A supplied key is used for that request and nothing else: it is never
 *   logged, never written to disk, and never persisted between requests.
 */
export function createYouCamClient(apiKey?: string): YouCamClient {
  return new YouCamClient({
    apiKey: apiKey?.trim() || process.env.YOUCAM_API_KEY || "",
    baseUrl: process.env.YOUCAM_API_BASE,
    reserveUnits: Number(process.env.YOUCAM_RESERVE_UNITS ?? 0),
  });
}
