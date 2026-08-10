/**
 * Instrument characterisation for the YouCam Skin Analysis API.
 *
 * Assay's central claim is that a change smaller than the instrument's
 * error is not a change. That claim rests on an assumption which, as far as I
 * can find, nobody has tested and Perfect Corp does not publish:
 *
 *   Is the model deterministic?
 *
 * It matters because the SEM is estimated from the spread across replicate
 * frames within one session, and that spread is attributed entirely to capture
 * variation, pose, distance, illumination. If the model itself returns
 * different numbers for identical input, then part of that spread is model
 * noise, and the attribution is wrong.
 *
 * Three experiments, run on a single synthetic face so that the subject is held
 * perfectly constant. Using a generated face here is deliberate and correct:
 * characterising an instrument requires a fixed reference, and it means no real
 * person is scored to produce these numbers.
 *
 *   1. Determinism: the same file, analysed repeatedly.
 *   2. Re-encoding: the same pixels at different JPEG qualities.
 *   3. Illumination: the same face, brightened and darkened slightly.
 *
 *   node scripts/experiment-reliability.mjs [--image path] [--dry-run]
 *
 * Costs roughly 108 units. Writes results to experiments/reliability.json.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const BASE = process.env.YOUCAM_API_BASE ?? "https://yce-api-01.makeupar.com";
const CONCERNS = ["texture", "redness", "moisture", "acne", "pore", "radiance"];
const NON_CONCERNS = new Set(["all", "skin_age", "resize_image"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const imageArg = args[args.indexOf("--image") + 1];
const IMAGE =
  imageArg && imageArg !== "--dry-run"
    ? join(ROOT, imageArg)
    : join(ROOT, ".scratch", "testface.jpg");

async function loadKey() {
  if (process.env.YOUCAM_API_KEY) return process.env.YOUCAM_API_KEY;
  const raw = await readFile(join(ROOT, ".env.local"), "utf8");
  return raw.match(/^YOUCAM_API_KEY=(.+)$/m)?.[1]?.trim();
}

const KEY = await loadKey();
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  const body = JSON.parse(await response.text());
  if (!response.ok || (body.status && body.status >= 400)) {
    throw new Error(`${path}: ${body.error ?? response.status}`);
  }
  return body.data ?? body.result ?? body.results ?? body;
}

async function analyse(buffer, label) {
  const upload = await call("/s2s/v2.0/file/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      files: [
        {
          content_type: "image/jpeg",
          file_name: `${label}.jpg`,
          file_size: buffer.length,
        },
      ],
    }),
  });
  const target = upload.files[0];
  const spec = target.requests[0];
  const put = await fetch(spec.url, {
    method: "PUT",
    headers: spec.headers,
    body: buffer,
  });
  if (!put.ok) throw new Error(`upload ${label}: HTTP ${put.status}`);

  const task = await call("/s2s/v2.0/task/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      src_file_id: target.file_id,
      dst_actions: CONCERNS,
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
      const scores = {};
      for (const entry of status.results?.output ?? []) {
        if (NON_CONCERNS.has(entry.type)) continue;
        if (typeof entry.raw_score === "number") scores[entry.type] = entry.raw_score;
      }
      return scores;
    }
    if (status.task_status === "error")
      throw new Error(`${label}: ${status.error_code ?? "error"}`);
  }
  throw new Error(`${label}: timed out`);
}

async function balance() {
  const data = await call("/s2s/v1.0/client/credit", { method: "GET" });
  return Array.isArray(data) ? data.reduce((s, b) => s + (b.amount ?? 0), 0) : null;
}

const base = sharp(IMAGE).rotate().resize(1024, 1024, { fit: "inside" });

/** Build the variant set for every experiment up front so costs are known. */
const variants = [];

// 1. Determinism, byte-identical input, three times.
const canonical = await base.clone().jpeg({ quality: 88 }).toBuffer();
for (let i = 1; i <= 3; i++) {
  variants.push({
    experiment: "determinism",
    label: `identical-${i}`,
    buffer: canonical,
  });
}

// 2. Re-encoding, same pixels, different JPEG quality. Visually indistinguishable.
for (const quality of [80, 92, 96]) {
  variants.push({
    experiment: "reencoding",
    label: `q${quality}`,
    buffer: await base.clone().jpeg({ quality }).toBuffer(),
  });
}

// 3. Illumination: the difference between a window and a lamp is roughly this.
for (const brightness of [0.92, 1.0, 1.08]) {
  variants.push({
    experiment: "illumination",
    label: `bright-${brightness}`,
    buffer: await base.clone().modulate({ brightness }).jpeg({ quality: 88 }).toBuffer(),
  });
}

console.log(`Image:    ${IMAGE}`);
console.log(`Variants: ${variants.length}`);
console.log(`Estimated cost: ${variants.length * 12} units\n`);

if (dryRun) {
  for (const v of variants)
    console.log(
      `  ${v.experiment.padEnd(13)} ${v.label.padEnd(14)} ${(v.buffer.length / 1024).toFixed(0)} KB`,
    );
  console.log("\nDry run: nothing spent.");
  process.exit(0);
}

const before = await balance();
console.log(`Balance before: ${before}\n`);

const results = [];
for (const variant of variants) {
  process.stdout.write(`  ${variant.experiment.padEnd(13)} ${variant.label.padEnd(14)} `);
  const scores = await analyse(variant.buffer, variant.label);
  results.push({ ...variant, buffer: undefined, bytes: variant.buffer.length, scores });
  console.log(CONCERNS.map((c) => (scores[c] ?? NaN).toFixed(2).padStart(7)).join(""));
}

const after = await balance();

// ---- Analysis -------------------------------------------------------------

function summarise(experiment) {
  const rows = results.filter((r) => r.experiment === experiment);
  const out = {};
  for (const concern of CONCERNS) {
    const values = rows
      .map((r) => r.scores[concern])
      .filter((v) => typeof v === "number");
    if (values.length < 2) continue;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1),
    );
    out[concern] = {
      values,
      mean,
      sd,
      range: Math.max(...values) - Math.min(...values),
      mdc95: 1.96 * Math.SQRT2 * sd,
    };
  }
  return out;
}

const analysis = {
  image: IMAGE,
  ranAt: new Date().toISOString(),
  concerns: CONCERNS,
  unitsSpent: before - after,
  experiments: {
    determinism: summarise("determinism"),
    reencoding: summarise("reencoding"),
    illumination: summarise("illumination"),
  },
  raw: results,
};

await mkdir(join(ROOT, "experiments"), { recursive: true });
await writeFile(
  join(ROOT, "experiments", "reliability.json"),
  `${JSON.stringify(analysis, null, 2)}\n`,
  "utf8",
);

function report(title, key, note) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${note}\n${"=".repeat(72)}`);
  console.log("concern      range     SD     implied MDC95");
  for (const [concern, stat] of Object.entries(analysis.experiments[key])) {
    console.log(
      `  ${concern.padEnd(10)} ${stat.range.toFixed(3).padStart(7)} ${stat.sd.toFixed(3).padStart(7)}   ${stat.mdc95.toFixed(2).padStart(7)}`,
    );
  }
}

report(
  "1. DETERMINISM",
  "determinism",
  "Byte-identical input, analysed three times. Any spread here is model noise.",
);
report(
  "2. RE-ENCODING",
  "reencoding",
  "Identical pixels at JPEG q80/q92/q96. Visually indistinguishable to a person.",
);
report(
  "3. ILLUMINATION",
  "illumination",
  "Same face at 92% / 100% / 108% brightness. Roughly a lamp versus a window.",
);

console.log(`\nUnits spent: ${before - after}. Written to experiments/reliability.json`);
