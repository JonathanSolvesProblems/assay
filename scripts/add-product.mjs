/**
 * Register the product under test.
 *
 * Detects the active ingredients from the product name, resolves the onset and
 * assessment windows from the actives catalogue, and writes the product into the
 * study. Those windows are what let a verdict distinguish "no effect" from "too
 * early to tell", so nothing can be judged until this has been run.
 *
 *   node scripts/add-product.mjs "The Ordinary Hyaluronic Acid 2% + B5"
 *   node scripts/add-product.mjs "CeraVe Moisturising Cream" --day 0
 *   node scripts/add-product.mjs "Some Serum" --actives humectant,niacinamide
 *
 * Deliberately not inferred or defaulted. A product recorded here that is not
 * actually being applied would make every downstream verdict a fabrication.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const STUDY_PATH = join(ROOT, "src", "data", "study.json");
const ACTIVES_PATH = join(ROOT, "src", "lib", "domain", "actives.ts");

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));

if (!name) {
  console.error(
    'Usage: node scripts/add-product.mjs "<product name>" [--day n] [--actives id,id]\n' +
      "\nThe name is matched against the actives catalogue to set the onset and\n" +
      "assessment windows. Pass --actives to override the detection.",
  );
  process.exit(1);
}

const dayFlag = args.indexOf("--day");
const day = dayFlag !== -1 ? Number(args[dayFlag + 1]) : 0;
const activesFlag = args.indexOf("--actives");
const forcedActives = activesFlag !== -1 ? args[activesFlag + 1].split(",") : null;

// Parse the catalogue out of the TypeScript source rather than duplicating it,
// so the windows quoted here can never drift from the ones the engine applies.
const source = await readFile(ACTIVES_PATH, "utf8");
const catalogue = [...source.matchAll(/id:\s*"([a-z_]+)",\s*\n\s*label:\s*"([^"]+)",\s*\n\s*aliases:\s*\[([^\]]*)\]/g)].map(
  (m) => ({
    id: m[1],
    label: m[2],
    aliases: [...m[3].matchAll(/"([^"]+)"/g)].map((a) => a[1]),
  }),
);

const onsets = Object.fromEntries(
  [...source.matchAll(/id:\s*"([a-z_]+)"[\s\S]*?onsetDays:\s*(\d+),\s*\n\s*assessAtDays:\s*(\d+)/g)].map(
    (m) => [m[1], { onset: Number(m[2]), assess: Number(m[3]) }],
  ),
);

const haystack = name.toLowerCase();
const detected = forcedActives
  ? catalogue.filter((a) => forcedActives.includes(a.id))
  : catalogue.filter((a) => a.aliases.some((alias) => haystack.includes(alias)));

if (detected.length === 0) {
  console.error(`No active ingredient recognised in "${name}".\n`);
  console.error("Known actives:");
  for (const a of catalogue) console.error(`  ${a.id.padEnd(18)} ${a.label}`);
  console.error("\nRe-run with --actives <id>, e.g. --actives humectant");
  process.exit(1);
}

const study = JSON.parse(await readFile(STUDY_PATH, "utf8"));

const product = {
  id: name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48),
  name,
  activeIds: detected.map((a) => a.id),
  startedDay: day,
};

if (study.products.some((p) => p.id === product.id)) {
  console.error(`"${name}" is already registered in this study.`);
  process.exit(1);
}

study.products.push(product);
await writeFile(STUDY_PATH, `${JSON.stringify(study, null, 2)}\n`, "utf8");

const horizon = Math.max(...detected.map((a) => onsets[a.id]?.assess ?? 56));
const onset = Math.min(...detected.map((a) => onsets[a.id]?.onset ?? 28));

console.log(`\nRegistered: ${name}`);
console.log(`  started day     ${day}`);
console.log(`  actives         ${detected.map((a) => a.label).join(", ")}`);
console.log(`  earliest effect day ${onset}`);
console.log(`  fair assessment day ${horizon}`);
console.log(
  `\nBefore day ${horizon}, a flat result reports as "not enough evidence yet" rather\n` +
    `than "not working". That is the distinction the study exists to make.`,
);
console.log(`\nStudy now holds ${study.products.length} product(s).`);
