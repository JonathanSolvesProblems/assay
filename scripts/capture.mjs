/**
 * Ingest a capture session into the study.
 *
 * Takes a folder of photographs, normalises each frame, runs it through the
 * YouCam Skin Analysis API, and appends the resulting session to
 * src/data/study.json. The photographs themselves never leave the machine and
 * are never committed, only the scores the API returned.
 *
 *   node scripts/capture.mjs --dir captures/day0 --type calibration --note "window light"
 *   node scripts/capture.mjs --dir captures/day1 --type treatment --day 1
 *
 * Options:
 *   --dir <path>      folder of frames for this session (required)
 *   --type <t>        calibration | treatment            (default: treatment)
 *   --day <n>         study day; inferred from startedAt if omitted
 *   --note <text>     free-text note, e.g. the lighting condition
 *   --dry-run         normalise and report, spend no units
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const STUDY_PATH = join(ROOT, "src", "data", "study.json");

const CAPTURE_LONG_EDGE = 1024;
const CAPTURE_JPEG_QUALITY = 88;
const MIN_SHORT_EDGE = 480;

/**
 * Fraction of the centre square kept, and how far that window is shifted up.
 * Both must stay fixed for the life of a study: changing the framing rule
 * between sessions would change the measurement, not just the picture.
 */
const CROP_FRACTION = 0.7;
const CROP_TOP_BIAS = 0.75;

function parseArgs(argv) {
  const args = { type: "treatment", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--dir") args.dir = argv[++i];
    else if (flag === "--type") args.type = argv[++i];
    else if (flag === "--day") args.day = Number(argv[++i]);
    else if (flag === "--note") args.note = argv[++i];
  }
  return args;
}

async function loadKey() {
  if (process.env.YOUCAM_API_KEY) return process.env.YOUCAM_API_KEY;
  const raw = await readFile(join(ROOT, ".env.local"), "utf8");
  const key = raw.match(/^YOUCAM_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!key) throw new Error("YOUCAM_API_KEY not found in .env.local");
  return key;
}

const BASE = process.env.YOUCAM_API_BASE ?? "https://yce-api-01.makeupar.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient(key) {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  async function call(path, init = {}) {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(
        `Non-JSON response from ${path} (HTTP ${response.status}): ${text.slice(0, 160)}`,
      );
    }
    if (!response.ok || (body.status && body.status >= 400)) {
      throw new Error(`${path} failed: ${body.error ?? body.message ?? response.status}`);
    }
    // Envelope key varies by endpoint, see API_FINDINGS.md.
    return body.data ?? body.result ?? body.results ?? body;
  }

  return {
    call,
    async balance() {
      const data = await call("/s2s/v1.0/client/credit", { method: "GET" });
      return Array.isArray(data)
        ? data.reduce((sum, b) => sum + (b.amount ?? 0), 0)
        : null;
    },
    async analyze(bytes, fileName, concerns) {
      const upload = await call("/s2s/v2.0/file/skin-analysis", {
        method: "POST",
        body: JSON.stringify({
          files: [
            { content_type: "image/jpeg", file_name: fileName, file_size: bytes.length },
          ],
        }),
      });

      const target = upload.files[0];
      const spec = target.requests[0];
      const put = await fetch(spec.url, {
        method: spec.method ?? "PUT",
        headers: spec.headers,
        body: bytes,
      });
      if (!put.ok) throw new Error(`Presigned upload failed: HTTP ${put.status}`);

      const task = await call("/s2s/v2.0/task/skin-analysis", {
        method: "POST",
        body: JSON.stringify({
          src_file_id: target.file_id,
          dst_actions: concerns,
          format: "json",
        }),
      });

      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await sleep(2000);
        const status = await call(`/s2s/v2.0/task/skin-analysis/${task.task_id}`, {
          method: "GET",
        });
        if (status.task_status === "success") {
          return { taskId: task.task_id, output: status.results?.output ?? [] };
        }
        if (status.task_status === "error") {
          throw new Error(
            `Analysis failed: ${status.error ?? status.error_code ?? "unknown"}`,
          );
        }
      }
      throw new Error("Analysis did not complete within 180s");
    },
  };
}

/** Entries the service appends that are not skin concerns. */
const NON_CONCERNS = new Set(["all", "skin_age", "resize_image"]);

/**
 * Normalise a frame to 1024px.
 *
 * Not cosmetic: a 2048px frame was observed to hang the analyser indefinitely
 * while still consuming units, and a fixed capture size removes resolution as a
 * source of between-session variance in the noise floor. See API_FINDINGS.md.
 */
async function normalise(path) {
  const image = sharp(path).rotate(); // honour EXIF orientation, then drop EXIF
  const meta = await image.metadata();

  // Crop to a fixed window around the face, then downscale.
  //
  // The analyser rejects a frame with `error_src_face_too_small` when the face
  // occupies too little of the image. Measured: the requirement is a minimum
  // *proportion* of the frame, not a minimum pixel count: a full-frame crop at
  // 1536px was rejected while a 70% crop at 1024px passed, even though the face
  // was larger in absolute pixels in the rejected one. Raising resolution does
  // not help; cropping does.
  //
  // CROP_FRACTION takes the centre 70% of the square, and CROP_TOP_BIAS shifts
  // that window upward because a head sits above the centre of a portrait.
  //
  // This is a fixed geometric rule rather than face detection on purpose: every
  // session must be processed identically, and a detector that framed each day
  // slightly differently would inject variance into the very noise floor this
  // pipeline exists to measure.
  const rotated = await image.toBuffer();
  const dims = await sharp(rotated).metadata();
  const side = Math.min(dims.width, dims.height);
  const window = Math.round(side * CROP_FRACTION);

  const buffer = await sharp(rotated)
    .extract({
      left: Math.round((dims.width - window) / 2),
      top: Math.round(((dims.height - window) / 2) * CROP_TOP_BIAS),
      width: window,
      height: window,
    })
    .resize(CAPTURE_LONG_EDGE, CAPTURE_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: CAPTURE_JPEG_QUALITY })
    .toBuffer();

  const out = await sharp(buffer).metadata();
  if (Math.min(out.width, out.height) < MIN_SHORT_EDGE) {
    throw new Error(
      `${basename(path)} is ${out.width}x${out.height} after resize; the analyser needs a short side of at least ${MIN_SHORT_EDGE}px.`,
    );
  }

  return {
    buffer,
    width: out.width,
    height: out.height,
    sourceWidth: meta.width,
    sourceHeight: meta.height,
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.dir) {
  console.error(
    "Usage: node scripts/capture.mjs --dir <folder> [--type calibration|treatment] [--day n] [--note text] [--dry-run]",
  );
  process.exit(1);
}

const study = JSON.parse(await readFile(STUDY_PATH, "utf8"));
const concerns = study.concerns;

const dir = join(ROOT, args.dir);
const files = (await readdir(dir))
  .filter((f) => [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase()))
  .sort();

if (files.length === 0) {
  console.error(`No .jpg/.jpeg/.png frames found in ${dir}`);
  process.exit(1);
}
if (files.length < 2) {
  console.error(
    `Only ${files.length} frame found. A session needs at least 2 replicate frames: the whole point is\n` +
      `measuring how much the reading moves when your skin has not changed. Three is the target.`,
  );
  process.exit(1);
}

// Study day: explicit, else days elapsed since the study start date.
const day =
  args.day ??
  Math.round((Date.now() - Date.parse(study.startedAt)) / 86_400_000) *
    (args.type === "calibration" ? 0 : 1);

console.log(`\nSession: ${args.type}, day ${day}`);
console.log(`Frames:  ${files.length} in ${args.dir}`);
console.log(`Concerns: ${concerns.join(", ")}\n`);

const prepared = [];
for (const file of files) {
  const frame = await normalise(join(dir, file));
  prepared.push({ file, ...frame });
  console.log(
    `  ${file.padEnd(28)} ${frame.sourceWidth}x${frame.sourceHeight} -> ${frame.width}x${frame.height}  ${(frame.buffer.length / 1024).toFixed(0)} KB`,
  );
}

const estimate = prepared.length * 12;
console.log(`\nEstimated cost: ${estimate} units (12 per frame, measured)`);

if (args.dryRun) {
  console.log("Dry run: nothing uploaded, no units spent.");
  process.exit(0);
}

const client = makeClient(await loadKey());
const before = await client.balance();
console.log(`Balance before: ${before}`);

if (before !== null && before < estimate) {
  console.error(`Insufficient units: need ~${estimate}, have ${before}.`);
  process.exit(1);
}

const readings = {};
const taskIds = [];

// One bad frame must not discard the session. A rejected frame costs no units
// (verified: the balance is unchanged after an error_src_face_too_small), so
// the right response is to note it and carry on with the rest.
const failures = [];

for (const [index, frame] of prepared.entries()) {
  process.stdout.write(`\nAnalysing ${frame.file} ... `);
  try {
    const { taskId, output } = await client.analyze(
      frame.buffer,
      `frame-${index}.jpg`,
      concerns,
    );
    taskIds.push(taskId);

    for (const entry of output) {
      if (NON_CONCERNS.has(entry.type)) continue;
      if (typeof entry.raw_score !== "number") continue;
      // Statistics run on raw_score: ui_score is a rounded, non-linear remap and
      // a noise floor built from integers would be badly quantised.
      (readings[entry.type] ??= []).push(entry.raw_score);
    }
    console.log("done");
  } catch (error) {
    failures.push({ file: frame.file, reason: error.message });
    console.log(`FAILED, ${error.message}`);
  }
}

const analysed = prepared.length - failures.length;
if (analysed < 2) {
  console.error(
    `\nOnly ${analysed} frame(s) analysed successfully. A session needs at least two:\n` +
      `the spread between replicate frames is the entire measurement. Nothing was written.\n`,
  );
  for (const f of failures) console.error(`  ${f.file}: ${f.reason}`);
  if (failures.some((f) => /face_too_small/.test(f.reason))) {
    console.error(
      `\nerror_src_face_too_small means the face fills too little of the frame.\n` +
        `Retake from closer in, or lower CROP_FRACTION (currently ${CROP_FRACTION}).`,
    );
  }
  process.exit(1);
}

if (failures.length > 0) {
  console.log(`\n${failures.length} frame(s) rejected and excluded from this session:`);
  for (const f of failures) console.log(`  ${f.file}: ${f.reason}`);
}

console.log("\nScores this session:");
for (const concern of concerns) {
  const values = readings[concern];
  if (!values?.length) {
    console.log(`  ${concern.padEnd(10)} (not returned)`);
    continue;
  }
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const spread = Math.max(...values) - Math.min(...values);
  console.log(
    `  ${concern.padEnd(10)} ${values.map((v) => v.toFixed(1).padStart(6)).join("  ")}   mean ${mean.toFixed(1).padStart(6)}   spread ${spread.toFixed(1)}`,
  );
}

const session = {
  id: `${args.type}-${day}-${Date.now().toString(36)}`,
  day,
  capturedAt: new Date().toISOString(),
  readings,
  ...(args.note ? { note: args.note } : {}),
  taskIds,
};

const bucket = args.type === "calibration" ? "calibrationSessions" : "treatmentSessions";
study[bucket].push(session);
study[bucket].sort((a, b) => a.day - b.day);

await writeFile(STUDY_PATH, `${JSON.stringify(study, null, 2)}\n`, "utf8");

const after = await client.balance();
console.log(`\nAppended to study.json as ${session.id}`);
console.log(`Balance after: ${after}  (spent ${before - after})`);
console.log(
  `Study now holds ${study.calibrationSessions.length} calibration and ${study.treatmentSessions.length} treatment sessions.`,
);
