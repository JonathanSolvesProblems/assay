/** Wire types for the YouCam (Perfect Corp) server-to-server API, v2.0. */

/**
 * The response envelope. The payload key is not consistent across the API:
 * v2.0 file and task endpoints use `data`, `credit/feature-cost` uses `result`,
 * and the v1.0 credit endpoint uses `results` with an array. All three are
 * declared so the client can fall through them in order.
 */
export interface YouCamEnvelope<T> {
  status: number;
  data?: T;
  result?: T;
  results?: T;
  error?: string;
  error_code?: string;
  /** Some endpoints return camelCase instead. */
  errorCode?: string;
  message?: string;
}

export interface FileUploadRequest {
  content_type: string;
  file_name: string;
  file_size: number;
}

export interface FileUploadTarget {
  file_id: string;
  requests: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
  }>;
}

export interface FileUploadResponse {
  files: FileUploadTarget[];
}

export interface TaskCreatedResponse {
  task_id: string;
}

export type TaskStatus = "success" | "running" | "error";

/** One concern's result: a 0-100 presentation score plus the underlying value. */
export interface SkinAnalysisOutput {
  type: string;
  ui_score: number;
  raw_score: number;
  mask_urls?: string[];
}

export interface SkinAnalysisTaskResponse {
  task_status: TaskStatus;
  results?: {
    output?: SkinAnalysisOutput[];
  };
  error?: string;
  error_code?: string;
  /** Present while the task is still running. */
  polling_interval?: number;
}

export interface CreditResponse {
  /** Remaining units on the account. */
  credit?: number;
  total?: number;
  [key: string]: unknown;
}

/**
 * A priced feature. The live shape is `{description, amount, unit, proc_unit,
 * run_task_url}` under a `skus` array: not the `{feature, cost}` the docs
 * suggest.
 *
 * Worth knowing: this catalogue does not list Skin Analysis or Clothes VTO at
 * all. It returned twenty image-editing and hair SKUs, so it cannot be used to
 * budget a skin study. The cost was established empirically instead: a
 * six-concern analysis debits 12 units.
 */
export interface FeatureCostEntry {
  description: string;
  amount: number;
  unit: string;
  proc_unit?: number;
  run_task_url?: string;
  [key: string]: unknown;
}

/** Measured on 27 Jul 2026: six SD concerns in one call debited 12 units. */
export const MEASURED_SKIN_ANALYSIS_COST = 12;

/** Documented failure codes worth handling distinctly rather than as "500". */
export const YOUCAM_ERROR_CODES = {
  NO_FACE: "error_no_face",
  /** The face occupies too little of the frame. Cropping fixes it; upscaling does not. */
  FACE_TOO_SMALL: "error_src_face_too_small",
  /** The head is turned too far from the camera for landmarks to resolve. */
  FACE_ANGLE: "error_large_face_angle",
  NSFW: "error_nsfw_content_detected",
  FILE_TOO_LARGE: "exceed_max_filesize",
  INVALID_TASK: "InvalidTaskId",
  INVALID_PARAMS: "InvalidParameters",
} as const;
