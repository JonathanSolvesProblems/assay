"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CAPTURE_JPEG_QUALITY,
  CAPTURE_LONG_EDGE,
  MIN_SHORT_EDGE_SD,
  cropWindow,
  preferredCamera,
} from "@/lib/youcam/image";
import { CONCERNS, DEFAULT_CONCERNS, type ConcernId } from "@/lib/domain/concerns";
import {
  estimateReliability,
  type ReliabilityEstimate,
  type Session,
} from "@/lib/stats/reliability";

const FRAMES_PER_SESSION = 3;
const SECONDS_BETWEEN_FRAMES = 3;

/**
 * Below this mean luma the feed is not a face, it is a black rectangle.
 *
 * Windows will happily hand back a live MediaStream from a virtual camera that
 * has nothing behind it, such as a phone offered through Link to Windows that is
 * not currently connected. The stream reports readyState 4 and real dimensions,
 * so nothing about it looks broken; every frame is simply black. A covered lens
 * or a laptop privacy shutter produces the same thing.
 *
 * Without this guard the app offers to capture, spends units on frames with no
 * face in them, and only then reports failure.
 */
const MIN_USABLE_LUMINANCE = 6;

/** Above this the frame is blown out and skin detail is clipped away. */
const MAX_USABLE_LUMINANCE = 88;

/**
 * Share of the frame height the face should span before capture.
 *
 * The analyser rejects a face that fills too little of the frame, and it only
 * says so after the units are spent. Checking in the browser turns a paid
 * failure into live guidance.
 */
const MIN_FACE_HEIGHT_RATIO = 0.34;

type Guidance = { label: string; state: "ok" | "warn" };

interface AnalyzeResponse {
  readings: Record<string, number[]>;
  frameCount: number;
  taskIds: string[];
  unitsBefore: number | null;
  unitsAfter: number | null;
  capturedAt: string;
  error?: string;
}

type Phase = "idle" | "streaming" | "capturing" | "analysing" | "done" | "error";

export function CaptureSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captured, setCaptured] = useState(0);
  const [luminance, setLuminance] = useState<number | null>(null);
  const [luminanceLog, setLuminanceLog] = useState<number[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  /** Face height as a share of frame height, or null when undetectable. */
  const [faceRatio, setFaceRatio] = useState<number | null>(null);

  // Live luminance. This is on-thesis rather than decorative: illumination is
  // the single largest source of error in the whole pipeline, and showing it
  // moving in real time is the fastest way to make that legible.
  useEffect(() => {
    if (phase !== "streaming" && phase !== "capturing") return;

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      context.drawImage(video, 0, 0, 64, 64);
      const { data } = context.getImageData(0, 0, 64, 64);

      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Rec. 601 luma, which tracks perceived brightness better than a mean.
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      setLuminance((sum / (data.length / 4) / 255) * 100);

      // Face size, where the browser can measure it. FaceDetector is not
      // universally available, so this is progressive enhancement: without it
      // the oval guide and the server's own rejection still apply, and the chip
      // simply does not appear.
      const Detector = (
        window as unknown as {
          FaceDetector?: new () => {
            detect(s: CanvasImageSource): Promise<{ boundingBox: DOMRectReadOnly }[]>;
          };
        }
      ).FaceDetector;
      if (Detector) {
        try {
          const faces = await new Detector().detect(video);
          setFaceRatio(
            faces.length > 0 ? faces[0].boundingBox.height / video.videoHeight : null,
          );
        } catch {
          setFaceRatio(null);
        }
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [phase]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  /**
   * List the available cameras.
   *
   * Labels are only populated once permission has been granted, so this runs
   * after the first successful getUserMedia rather than before it.
   */
  async function refreshCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput"));
    } catch {
      // A browser that will not enumerate devices still works with the default.
    }
  }

  async function startCamera(deviceId?: string) {
    setMessage(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // An explicit device wins; otherwise ask for a front-facing one.
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("streaming");
      const activeId =
        stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? "";
      setCameraId(activeId);

      // Labels are only readable once permission has been granted, so the first
      // open is the earliest point at which a virtual camera can be recognised.
      // If the browser handed us one, switch to a real sensor without making the
      // user discover the dropdown.
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput",
      );
      setCameras(devices);

      // Only switch away from a device that actually looks virtual, and never at
      // the cost of a stream that is already working. An earlier version stopped
      // the live stream and reopened with a deviceId exact constraint; when that
      // constraint could not be satisfied the failure landed in the catch below
      // and the user was left with an error instead of the working camera they
      // already had.
      if (!deviceId) {
        const active = devices.find((d) => d.deviceId === activeId);
        const preferred = preferredCamera(devices);
        const activeLooksVirtual =
          active !== undefined && preferred !== undefined && active !== preferred;

        if (activeLooksVirtual && preferred.deviceId) {
          try {
            await startCamera(preferred.deviceId);
          } catch {
            // Keep whatever is already streaming rather than stranding the user.
          }
        }
      }
    } catch (error) {
      // A failed switch to a specific device must not tear down a session that
      // is already streaming; let the caller decide.
      if (deviceId && streamRef.current) throw error;

      setPhase("error");
      setMessage(
        "Could not open the camera. Grant camera permission, or upload photographs instead: the analysis is identical either way.",
      );
    }
  }

  /** Draw the current video frame at a fixed size and quality. */
  async function grabFrame(): Promise<Blob> {
    const video = videoRef.current;
    if (!video) throw new Error("Camera is not running.");

    const { videoWidth: w, videoHeight: h } = video;
    // Crop to the same window the video ingest uses. Sending the whole 16:9
    // frame leaves the face too small a fraction of the image and the analyser
    // rejects it with error_src_face_too_small.
    const { sx, sy, size } = cropWindow(w, h);
    const side = Math.min(CAPTURE_LONG_EDGE, Math.max(size, MIN_SHORT_EDGE_SD));

    if (size < MIN_SHORT_EDGE_SD) {
      throw new Error(
        `Camera gives a ${w}x${h} frame, which crops to ${size}px; the analyser needs at least ${MIN_SHORT_EDGE_SD}px. Try a higher-resolution camera.`,
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not acquire a canvas context.");
    context.drawImage(video, sx, sy, size, size, 0, 0, side, side);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CAPTURE_JPEG_QUALITY),
    );
    if (!blob) throw new Error("Could not encode the frame.");
    return blob;
  }

  async function runCapture() {
    setPhase("capturing");
    framesRef.current = [];
    setCaptured(0);
    setLuminanceLog([]);

    try {
      for (let i = 0; i < FRAMES_PER_SESSION; i++) {
        for (let s = SECONDS_BETWEEN_FRAMES; s > 0; s--) {
          setCountdown(s);
          await wait(1000);
        }
        setCountdown(null);

        framesRef.current.push(await grabFrame());
        setCaptured(i + 1);
        setLuminanceLog((log) => [...log, luminance ?? 0]);
        await wait(350);
      }

      stopStream();
      await analyse(framesRef.current);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Capture failed.");
    }
  }

  async function analyse(frames: Blob[]) {
    setPhase("analysing");
    setMessage(null);

    const form = new FormData();
    frames.forEach((blob, i) => form.append("frames", blob, `frame-${i}.jpg`));
    form.append("concerns", DEFAULT_CONCERNS.join(","));

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const payload = (await response.json()) as AnalyzeResponse;

      if (!response.ok) {
        setPhase("error");
        setMessage(payload.error ?? "Analysis failed.");
        return;
      }

      setResult(payload);
      setPhase("done");
      persist(payload);
    } catch {
      setPhase("error");
      setMessage("Could not reach the analysis service.");
    }
  }

  async function onFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length < 2) {
      setMessage(
        "Choose at least two photographs taken seconds apart. The spread between them is what measures the error.",
      );
      return;
    }

    try {
      const frames = await Promise.all(files.slice(0, 3).map(normaliseFile));
      framesRef.current = frames;
      setCaptured(frames.length);
      await analyse(frames);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Could not read those files.");
    }
  }

  // A live stream carrying nothing but black. See MIN_USABLE_LUMINANCE.
  const feedIsDark =
    phase === "streaming" && luminance !== null && luminance < MIN_USABLE_LUMINANCE;

  /**
   * Live capture guidance, the same three things the analyser will judge after
   * the fact: is there light, is it not blown out, and is the face big enough.
   * Saying so before the shutter turns a paid rejection into a nudge.
   */
  const guidance: Guidance[] =
    phase !== "streaming"
      ? []
      : [
          luminance === null
            ? { label: "Reading light", state: "warn" as const }
            : luminance < MIN_USABLE_LUMINANCE
              ? { label: "Too dark", state: "warn" as const }
              : luminance > MAX_USABLE_LUMINANCE
                ? { label: "Too bright", state: "warn" as const }
                : { label: "Lighting ok", state: "ok" as const },
          ...(faceRatio === null
            ? []
            : [
                faceRatio < MIN_FACE_HEIGHT_RATIO
                  ? { label: "Come closer", state: "warn" as const }
                  : { label: "Face position ok", state: "ok" as const },
              ]),
        ];

  const faceTooSmall = faceRatio !== null && faceRatio < MIN_FACE_HEIGHT_RATIO;

  const reliability = result ? reliabilityFrom(result.readings) : null;

  /**
   * A floor of zero is not a perfect instrument, it is identical frames.
   *
   * Real frames always differ a little, if only by sensor noise, so a spread of
   * exactly zero means the same image was measured more than once: three copies
   * of one uploaded photograph, or a static virtual camera. Left alone this is
   * the most dangerous output the app can produce, because a floor of zero lets
   * every subsequent change count as real.
   */
  const degenerateFloor =
    reliability !== null &&
    Object.values(reliability).length > 0 &&
    Object.values(reliability).every((e) => e.mdc95SessionMean < 0.05);
  const luminanceDrift =
    luminanceLog.length >= 2
      ? Math.max(...luminanceLog) - Math.min(...luminanceLog)
      : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div>
        <div className="relative overflow-hidden rounded-none border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]">
          <div className="aspect-[4/3] w-full">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
              style={{
                display:
                  phase === "streaming" || phase === "capturing" ? "block" : "none",
              }}
            />

            {phase !== "streaming" && phase !== "capturing" && (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <p className="max-w-xs text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
                  {phase === "analysing"
                    ? "Analysing three frames. Each one is a separate call to the YouCam Skin Analysis API."
                    : phase === "done"
                      ? "Session complete. Your noise floor is on the right."
                      : "Assay takes three frames a few seconds apart. Your skin cannot change in that time, so any difference between them is the instrument's error."}
                </p>
              </div>
            )}
          </div>

          {/* Face guide. Reproducing framing between sessions is part of the protocol. */}
          {(phase === "streaming" || phase === "capturing") && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 400 300"
              preserveAspectRatio="xMidYMid slice"
            >
              <ellipse
                cx="200"
                cy="145"
                rx="76"
                ry="98"
                fill="none"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
              <line
                x1="200"
                y1="30"
                x2="200"
                y2="52"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
              />
              <line
                x1="200"
                y1="238"
                x2="200"
                y2="260"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
              />
            </svg>
          )}

          {countdown !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="tabular text-[76px] leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                {countdown}
              </span>
            </div>
          )}

          {(phase === "streaming" || phase === "capturing") && (
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
              {guidance.map((g) => (
                <span
                  key={g.label}
                  className="tabular rounded-none px-2.5 py-1 text-[10px] tracking-[0.08em] uppercase backdrop-blur-sm"
                  style={
                    g.state === "ok"
                      ? { background: "rgba(0,78,86,0.85)", color: "#fff" }
                      : { background: "rgba(20,22,26,0.8)", color: "#e8b4a0" }
                  }
                >
                  {g.label}
                </span>
              ))}
              <span className="tabular rounded-none bg-black/55 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm">
                {luminance === null ? "--" : luminance.toFixed(1)}
              </span>
            </div>
          )}

          {phase === "capturing" && (
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {Array.from({ length: FRAMES_PER_SESSION }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-6 rounded-none transition-colors duration-300"
                  style={{ background: i < captured ? "#fff" : "rgba(255,255,255,0.3)" }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {phase === "idle" || phase === "error" ? (
            <button
              onClick={() => startCamera()}
              className="rounded-none bg-[var(--color-ink)] px-5 py-2.5 text-[13px] tracking-[0.06em] uppercase text-[var(--color-paper)] transition-colors duration-150 hover:bg-[var(--color-spot)]"
            >
              Open camera
            </button>
          ) : null}

          {phase === "streaming" && cameras.length > 1 && (
            <select
              value={cameraId}
              onChange={(e) => startCamera(e.target.value)}
              aria-label="Camera"
              className="max-w-[220px] rounded-none border border-[var(--color-rule-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px]"
            >
              {cameras.map((device, i) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          {phase === "streaming" && (
            <button
              onClick={runCapture}
              disabled={feedIsDark || faceTooSmall}
              className="rounded-none bg-[var(--color-ink)] px-5 py-2.5 text-[13px] tracking-[0.06em] text-[var(--color-paper)] uppercase transition-colors duration-150 hover:bg-[var(--color-spot)] disabled:cursor-not-allowed disabled:bg-[var(--color-rule-strong)]"
            >
              Capture three frames
            </button>
          )}

          {faceTooSmall && !feedIsDark && (
            <p className="w-full text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
              Your face is filling too little of the frame. Move closer until your head
              roughly fills the oval. The analyser rejects a face below a minimum share of
              the image, and it only says so after the units are spent, so capture is held
              until the framing will pass.
            </p>
          )}

          {feedIsDark && (
            <p className="w-full text-[13px] leading-relaxed text-[var(--color-verdict-worsening-ink)]">
              That camera is sending a black picture. It is usually a lens cover, a
              privacy shutter, or a virtual camera such as a phone offered through Link to
              Windows that is not currently connected. Pick a different camera above, or
              upload photographs instead. Capture is held until the feed carries
              something, because analysing black frames would spend units to be told there
              is no face.
            </p>
          )}

          {(phase === "idle" || phase === "error" || phase === "done") && (
            <label className="cursor-pointer rounded-none border border-[var(--color-rule-strong)] px-5 py-2.5 text-[14px] transition-colors duration-200 hover:bg-[var(--color-surface-sunken)]">
              Upload photographs
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={onFilesChosen}
              />
            </label>
          )}

          {phase === "analysing" && (
            <span className="tabular text-[13px] text-[var(--color-ink-secondary)]">
              Analysing frame {captured} of {FRAMES_PER_SESSION}&hellip;
            </span>
          )}
        </div>

        {message && (
          <p className="mt-4 rounded-none bg-[var(--color-verdict-worsening-bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-verdict-worsening-ink)]">
            {message}
          </p>
        )}
      </div>

      <aside>
        {reliability ? (
          <NoiseFloorPanel
            degenerate={degenerateFloor}
            reliability={reliability}
            luminanceDrift={luminanceDrift}
            units={
              result && result.unitsBefore !== null && result.unitsAfter !== null
                ? result.unitsBefore - result.unitsAfter
                : null
            }
          />
        ) : (
          <Protocol />
        )}
      </aside>
    </div>
  );
}

function Protocol() {
  return (
    <div className="card p-6">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        Capture protocol
      </p>
      <ol className="mt-4 space-y-3.5 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
        {[
          "Face a steady light source. A window works; a lamp works. Mixing them does not.",
          "Hold the phone at arm's length, face filling the oval.",
          "No makeup, hair back off the face.",
          "Do not move between frames. Reproducing the same framing is what keeps the noise floor low.",
          "Repeat at the same time of day. Skin genuinely changes between morning and night.",
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="tabular shrink-0 text-[var(--color-ink-muted)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-[var(--color-rule)] pt-4 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
        Three frames cost about 36 API units. Photographs are sent to the YouCam Skin
        Analysis API for scoring and are never stored by Assay.
      </p>
    </div>
  );
}

function NoiseFloorPanel({
  degenerate,
  reliability,
  luminanceDrift,
  units,
}: {
  degenerate: boolean;
  reliability: Record<string, ReliabilityEstimate>;
  luminanceDrift: number | null;
  units: number | null;
}) {
  const entries = Object.entries(reliability);

  return (
    <div className="card p-6">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        Your noise floor
      </p>
      <h3 className="mt-2 font-serif text-[22px] leading-tight tracking-[0.005em]">
        What a change has to beat
      </h3>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
        Measured on your face, on your device, from three frames taken seconds apart. Any
        future change smaller than these numbers cannot be told apart from the instrument.
      </p>

      <dl className="mt-5 space-y-2.5">
        {entries.map(([concern, estimate]) => {
          const meta = CONCERNS[concern as ConcernId];
          const saturated = estimate.saturation !== "none";
          return (
            <div
              key={concern}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--color-rule)] pb-2.5 last:border-0"
            >
              <dt className="text-[13px]">{meta?.label ?? concern}</dt>
              <dd className="tabular text-[14px]">
                {saturated ? (
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                    saturated
                  </span>
                ) : (
                  <>&plusmn;{estimate.mdc95SessionMean.toFixed(1)}</>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {degenerate && (
        <p className="mt-4 rounded-none bg-[var(--color-verdict-worsening-bg)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-verdict-worsening-ink)]">
          Every floor came out at zero, which means the frames were identical rather than
          the instrument being perfect. Real frames always differ a little, if only by
          sensor noise. This happens when the same photograph is uploaded more than once,
          or a static virtual camera is selected. A floor of zero would let any later
          change count as real, so do not build a study on this session. Recapture from a
          live camera.
        </p>
      )}

      {entries.some(([, e]) => e.underestimates) && (
        <p className="mt-4 rounded-none bg-[var(--color-verdict-pending-bg)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-verdict-pending-ink)]">
          These are a lower bound. One session measures sensor and pose noise but cannot
          see the error you add by setting the camera back up tomorrow, and re-cropping
          the same photograph was measured to shift a texture score by 5.8 points. Capture
          two more sessions today, moving the camera in between, and the floor becomes the
          one that actually applies.
        </p>
      )}

      {luminanceDrift !== null && luminanceDrift > 2 && (
        <p className="mt-4 rounded-none bg-[var(--color-verdict-purge-bg)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-verdict-purge-ink)]">
          Your lighting moved {luminanceDrift.toFixed(1)} points during capture. That
          inflates the noise floor and makes real changes harder to detect. Recapturing
          under steadier light will tighten these numbers.
        </p>
      )}

      {units !== null && (
        <p className="mt-4 border-t border-[var(--color-rule)] pt-4 text-[12px] text-[var(--color-ink-muted)]">
          <span className="tabular">{units}</span> API units spent on this session.
        </p>
      )}
    </div>
  );
}

// ---- helpers --------------------------------------------------------------

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reliabilityFrom(readings: Record<string, number[]>) {
  const out: Record<string, ReliabilityEstimate> = {};
  for (const [concern, frames] of Object.entries(readings)) {
    if (frames.length < 2) continue;
    const session: Session = { id: "calibration", day: 0, frames };
    out[concern] = estimateReliability([session]);
  }
  return out;
}

/** Resize an uploaded photograph to the same spec the camera path produces. */
async function normaliseFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  // Same crop window as the camera path, so a session cannot mix two framings.
  const { sx, sy, size } = cropWindow(bitmap.width, bitmap.height);
  const width = Math.min(CAPTURE_LONG_EDGE, Math.max(size, MIN_SHORT_EDGE_SD));
  const height = width;

  if (size < MIN_SHORT_EDGE_SD) {
    throw new Error(
      `${file.name} crops to ${size}px; the analyser needs at least ${MIN_SHORT_EDGE_SD}px. Use a higher-resolution photograph.`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not acquire a canvas context.");
  context.drawImage(bitmap, sx, sy, size, size, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CAPTURE_JPEG_QUALITY),
  );
  if (!blob) throw new Error(`Could not encode ${file.name}.`);
  return blob;
}

/** Keep the session locally so a visitor can build up their own study. */
function persist(payload: AnalyzeResponse) {
  try {
    const key = "assay:sessions";
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
    existing.push({
      capturedAt: payload.capturedAt,
      readings: payload.readings,
      taskIds: payload.taskIds,
    });
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // Storage being unavailable must never break a capture.
  }
}
