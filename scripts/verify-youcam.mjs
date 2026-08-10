/**
 * Verifies a YouCam API key end to end, and reports what a capture session will
 * cost before any units are spent on one.
 *
 * Dependency-free and safe to run repeatedly: the balance and feature-cost
 * endpoints do not consume units. Pass an image path to additionally run one
 * real analysis, which does.
 *
 *   node scripts/verify-youcam.mjs                 # free checks only
 *   node scripts/verify-youcam.mjs ./face.jpg      # spends ~1 analysis
 */

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const KEY = process.env.YOUCAM_API_KEY ?? (await loadEnvKey());
const BASE = process.env.YOUCAM_API_BASE ?? "https://yce-api-01.makeupar.com";

const CONCERNS = ["texture", "redness", "moisture", "acne", "pore", "radiance"];

async function loadEnvKey() {
  try {
    const raw = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    return raw.match(/^YOUCAM_API_KEY=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 400);
  }
  return { status: response.status, body };
}

function heading(title) {
  console.log(`\n${"-".repeat(64)}\n${title}\n${"-".repeat(64)}`);
}

if (!KEY) {
  console.error("No YOUCAM_API_KEY found in the environment or .env.local");
  process.exit(1);
}

console.log(`Key ...${KEY.slice(-8)}   base ${BASE}`);

heading("Unit balance");
for (const path of ["/s2s/v1.0/client/credit", "/s2s/v2.0/credit"]) {
  const result = await call(path, { method: "GET" });
  console.log(`GET ${path} -> ${result.status}`);
  console.log(JSON.stringify(result.body, null, 2).slice(0, 900));
}

heading("Per-feature unit cost");
for (const path of [
  "/s2s/v2.0/credit/feature-cost",
  "/s2s/v2.0/credit/feature-cost?feature=skin-analysis",
]) {
  const result = await call(path, { method: "GET" });
  console.log(`GET ${path} -> ${result.status}`);
  const text = JSON.stringify(result.body, null, 2);
  console.log(text.length > 2500 ? `${text.slice(0, 2500)}\n...truncated` : text);
}

const imagePath = process.argv[2];
if (!imagePath) {
  heading("Analysis");
  console.log("Skipped. Pass an image path to run one real analysis:");
  console.log("  node scripts/verify-youcam.mjs ./face.jpg");
  process.exit(0);
}

heading(`Analysis on ${basename(imagePath)}`);
const bytes = await readFile(imagePath);
const contentType =
  extname(imagePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
console.log(`${(bytes.byteLength / 1024).toFixed(0)} KB, ${contentType}`);

// Step 1, reserve a file id and a presigned upload target.
const upload = await call("/s2s/v2.0/file/skin-analysis", {
  method: "POST",
  body: JSON.stringify({
    files: [
      {
        content_type: contentType,
        file_name: basename(imagePath),
        file_size: bytes.byteLength,
      },
    ],
  }),
});
console.log(`POST /file/skin-analysis -> ${upload.status}`);
if (upload.status !== 200) {
  console.log(JSON.stringify(upload.body, null, 2));
  process.exit(1);
}

const target = upload.body?.result?.files?.[0] ?? upload.body?.data?.files?.[0];
console.log(JSON.stringify(target, null, 2).slice(0, 700));

const fileId = target?.file_id;
const putSpec = target?.requests?.[0];
if (!fileId || !putSpec) {
  console.error("Could not find file_id / upload target in the response above.");
  process.exit(1);
}

// Step 2, PUT the bytes straight to the presigned URL.
const put = await fetch(putSpec.url, {
  method: putSpec.method ?? "PUT",
  headers: putSpec.headers ?? { "Content-Type": contentType },
  body: bytes,
});
console.log(`PUT presigned -> ${put.status}`);

// Step 3, start the analysis task.
const task = await call("/s2s/v2.0/task/skin-analysis", {
  method: "POST",
  body: JSON.stringify({ src_file_id: fileId, dst_actions: CONCERNS, format: "json" }),
});
console.log(`POST /task/skin-analysis -> ${task.status}`);
console.log(JSON.stringify(task.body, null, 2).slice(0, 600));

const taskId = task.body?.result?.task_id ?? task.body?.data?.task_id;
if (!taskId) process.exit(1);

// Step 4, poll.
for (let attempt = 0; attempt < 60; attempt++) {
  await new Promise((r) => setTimeout(r, 2000));
  const poll = await call(`/s2s/v2.0/task/skin-analysis/${taskId}`, { method: "GET" });
  const payload = poll.body?.result ?? poll.body?.data ?? poll.body;
  const status = payload?.task_status ?? payload?.status;
  process.stdout.write(`  poll ${attempt + 1}: ${status}\n`);

  if (status === "success") {
    heading("Result shape");
    console.log(JSON.stringify(payload, null, 2).slice(0, 4000));

    const outputs = payload?.results?.output ?? payload?.result?.output ?? [];
    if (Array.isArray(outputs) && outputs.length > 0) {
      heading("Scores");
      for (const o of outputs) {
        console.log(
          `  ${String(o.type).padEnd(12)} ui_score ${String(o.ui_score).padStart(6)}   raw ${String(o.raw_score).padStart(8)}   masks ${o.mask_urls?.length ?? 0}`,
        );
      }
      const withMask = outputs.find((o) => o.mask_urls?.length);
      if (withMask) {
        heading("Mask geometry (gates the split-face stretch goal)");
        console.log(withMask.mask_urls[0]);
      }
    }

    heading("Balance after");
    const after = await call("/s2s/v1.0/client/credit", { method: "GET" });
    console.log(JSON.stringify(after.body, null, 2).slice(0, 400));
    process.exit(0);
  }

  if (status === "error") {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
}

console.error("Task did not complete within 120s.");
process.exit(1);
