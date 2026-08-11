/**
 * Capture preparation rules.
 *
 * These constants exist because of a failure that cost real units to find, and
 * that appears nowhere in the documentation.
 *
 * A 2048x2048 / 5.27 MB frame was accepted by the file endpoint, accepted by
 * the task endpoint, charged 12 units, and then sat in `running` indefinitely, * still not resolved after four minutes of polling. The identical face resized
 * to 1024px / 167 KB completed in **four seconds**. The documented limits (long
 * side <= 4096px, file size < 10 MB) are both satisfied by the frame that hung,
 * so obeying the documented limits is not sufficient.
 *
 * Every frame is therefore normalised before upload. This is not only a
 * reliability fix: a fixed capture size is itself part of the measurement
 * protocol, because feeding the analyser images of varying resolution would add
 * yet another source of between-session variance to the noise floor that
 * Assay is trying to measure.
 */

/** Long side, in pixels, that every frame is resized to before upload. */
export const CAPTURE_LONG_EDGE = 1024;

/**
 * Fraction of the centre square kept before downscaling, and how far that window
 * is shifted upward.
 *
 * The analyser rejects a frame with `error_src_face_too_small` when the face
 * occupies too little of the image, and the requirement is a proportion of the
 * frame rather than a pixel count: a full-frame crop at 1536px was rejected while
 * a 70% crop at 1024px passed, with a smaller face in absolute pixels. Raising
 * resolution never helps; cropping does.
 *
 * A webcam frame is 16:9 with a lot of room in it, so the browser path uses the
 * same tighter window the video ingest does. Without this, live capture sends the
 * whole frame and is rejected every time, which is precisely what happened.
 *
 * The window is shifted up because a head sits above the centre of a portrait.
 */
export const CAPTURE_CROP_FRACTION = 0.55;
export const CAPTURE_CROP_TOP_BIAS = 0.6;

/**
 * Centre-square crop geometry for a source of the given dimensions.
 *
 * Shared by the camera path and the upload path so a session cannot mix two
 * framings, which would inject a step change larger than most treatment effects.
 */
export function cropWindow(width: number, height: number) {
  const side = Math.min(width, height);
  const window = Math.round(side * CAPTURE_CROP_FRACTION);
  return {
    sx: Math.round((width - window) / 2),
    sy: Math.round(((height - window) / 2) * CAPTURE_CROP_TOP_BIAS),
    size: window,
  };
}

/** JPEG quality used for upload. High enough to preserve fine skin texture. */
export const CAPTURE_JPEG_QUALITY = 0.88;

/**
 * Documented minimum short side for standard-definition analysis. HD concerns
 * require 1080, which is why Assay runs SD: 1024 is the size that is
 * reliably fast, and mixing modes mid-study would invalidate the noise floor.
 */
export const MIN_SHORT_EDGE_SD = 480;

/** Hard ceiling from the API. We stay far below it. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Practical ceiling, past which analyses were observed to stall. */
export const SAFE_UPLOAD_BYTES = 1_500_000;

export interface PreparedFrame {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Resize and re-encode a captured frame in the browser.
 *
 * Drawing through a canvas also strips EXIF, which matters here: phone captures
 * carry GPS and device metadata, and none of that needs to reach a third-party
 * API to score someone's skin.
 */
export async function prepareFrame(
  source: CanvasImageSource & {
    width: number;
    height: number;
  },
): Promise<PreparedFrame> {
  const { width: sourceWidth, height: sourceHeight } = source;

  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error("Cannot prepare a frame with zero dimensions.");
  }

  const scale = Math.min(1, CAPTURE_LONG_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  if (Math.min(width, height) < MIN_SHORT_EDGE_SD) {
    throw new Error(
      `Frame is ${width}x${height}; the analyser needs a short side of at least ${MIN_SHORT_EDGE_SD}px. Move the camera closer or use a higher-resolution capture.`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not acquire a 2D canvas context.");

  context.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CAPTURE_JPEG_QUALITY),
  );

  if (!blob) throw new Error("Could not encode the captured frame.");

  return { blob, width, height, bytes: blob.size };
}
