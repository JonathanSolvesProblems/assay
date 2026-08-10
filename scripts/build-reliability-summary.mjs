/**
 * Derive the figures shown on /method from the raw experiment output.
 *
 * The method page must never carry hand-typed numbers. Every value it renders
 * comes through this transform, so re-running the experiment and re-running this
 * updates the page, and a stale page is impossible.
 *
 *   node scripts/experiment-reliability.mjs
 *   node scripts/build-reliability-summary.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const raw = JSON.parse(
  await readFile(join(ROOT, "experiments", "reliability.json"), "utf8"),
);

const LABELS = {
  texture: "Texture",
  redness: "Redness",
  moisture: "Hydration",
  acne: "Blemishes",
  pore: "Pores",
  radiance: "Radiance",
};

/** Concerns shown in the error-budget table, widest-moving first. */
const BUDGET_CONCERNS = ["acne", "moisture", "texture", "pore"];

const determinism = raw.concerns.map((concern) => ({
  concern: LABELS[concern] ?? concern,
  range: raw.experiments.determinism[concern]?.range ?? 0,
  sd: raw.experiments.determinism[concern]?.sd ?? 0,
}));

const budget = [
  { source: "Model (identical bytes)", key: "determinism" },
  { source: "JPEG quality q80 to q96", key: "reencoding" },
  { source: "Brightness plus/minus 8%", key: "illumination" },
].map(({ source, key }) => ({
  source,
  values: BUDGET_CONCERNS.map((concern) => raw.experiments[key][concern]?.range ?? 0),
}));

const summary = {
  generatedFrom: "experiments/reliability.json",
  ranAt: raw.ranAt,
  unitsSpent: raw.unitsSpent,
  determinism,
  budgetConcerns: BUDGET_CONCERNS.map((c) => LABELS[c] ?? c),
  budget,
};

await writeFile(
  join(ROOT, "src", "data", "reliability-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log("Wrote src/data/reliability-summary.json");
console.log(`  determinism rows: ${determinism.length}`);
console.log(`  budget rows:      ${budget.length}`);
for (const row of budget) {
  console.log(
    `    ${row.source.padEnd(28)} ${row.values.map((v) => v.toFixed(2).padStart(7)).join("")}`,
  );
}
