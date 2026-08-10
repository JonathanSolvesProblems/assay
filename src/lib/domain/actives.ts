/**
 * Active ingredients, with the timescales on which they are actually capable of
 * doing anything.
 *
 * This catalogue is what lets Assay separate two conclusions that every
 * other skin tracker collapses into one shrug:
 *
 *   "No change yet, and it is too early for there to be one."   → keep going
 *   "No change, and we have now looked long enough to see one." → it is not working
 *
 * Telling someone their retinoid failed at day fourteen is not a cautious
 * result, it is a wrong one. Retinoids do not remodel anything on that
 * timescale, and a tracker that renders a verdict there is measuring noise.
 *
 * The `purge` window encodes the other thing consumers get wrong. Retinoids and
 * beta hydroxy acids cause a transient worsening before improvement, as
 * comedones already forming are pushed to the surface. Users read that as an
 * allergy and quit an effective product. Assay can see the difference,
 * because purging resolves inside a known window and irritation does not.
 *
 * Onset figures are drawn from the durations used in the registrational and
 * dermatological literature cited per entry. They are guides for study design,
 * not medical advice, and Assay presents them as such.
 */

import type { ConcernId } from "./concerns";

export interface PurgeWindow {
  /** Day the transient worsening typically begins. */
  startDay: number;
  /** Day by which it should have resolved. Past this, worsening is not purging. */
  endDay: number;
  /** Concerns expected to transiently worsen. */
  concerns: ConcernId[];
}

export interface Active {
  id: string;
  label: string;
  /** Lowercase substrings used to recognise this active in a product name. */
  aliases: string[];
  /** Concerns this active is expected to move, best-supported first. */
  targetConcerns: ConcernId[];
  /** Earliest day a real effect can begin to appear. */
  onsetDays: number;
  /**
   * Day from which a null result becomes meaningful. Before this, Assay
   * will not return "not working" no matter how flat the data.
   */
  assessAtDays: number;
  purge?: PurgeWindow;
  /** Source for the timescale, shown in the UI so the number is checkable. */
  citation: string;
}

export const ACTIVES: Active[] = [
  {
    id: "retinoid",
    label: "Retinoid (tretinoin, retinal, retinol)",
    aliases: [
      "retinol",
      "retinal",
      "retinaldehyde",
      "tretinoin",
      "retinoic",
      "adapalene",
      "retinoid",
    ],
    targetConcerns: ["texture", "acne", "pore", "wrinkle"],
    onsetDays: 28,
    assessAtDays: 84,
    purge: { startDay: 7, endDay: 42, concerns: ["acne", "redness", "texture"] },
    citation:
      "Mukherjee et al., Clin Interv Aging 2006;1(4):327-48, retinoid photoaging trials run 12-24 weeks; Kligman et al., J Am Acad Dermatol 1986.",
  },
  {
    id: "niacinamide",
    label: "Niacinamide",
    aliases: ["niacinamide", "vitamin b3", "nicotinamide"],
    targetConcerns: ["redness", "pore", "texture", "oiliness"],
    onsetDays: 14,
    assessAtDays: 56,
    citation:
      "Bissett et al., Dermatol Surg 2005;31(7):860-5, 12-week trial; barrier and redness endpoints move by week 4.",
  },
  {
    id: "vitamin_c",
    label: "Vitamin C (L-ascorbic acid)",
    aliases: ["vitamin c", "ascorbic", "ascorbate", "l-aa", "thd ascorbate"],
    targetConcerns: ["radiance", "age_spot", "texture"],
    onsetDays: 28,
    assessAtDays: 84,
    citation:
      "Telang, Indian Dermatol Online J 2013;4(2):143-6, topical vitamin C pigmentation endpoints assessed at 12 weeks.",
  },
  {
    id: "bha",
    label: "Salicylic acid (BHA)",
    aliases: ["salicylic", "bha", "beta hydroxy"],
    targetConcerns: ["acne", "pore", "oiliness", "texture"],
    onsetDays: 14,
    assessAtDays: 56,
    purge: { startDay: 5, endDay: 28, concerns: ["acne"] },
    citation:
      "Zheng et al., J Am Acad Dermatol 2023, topical acne endpoints conventionally assessed at 8-12 weeks.",
  },
  {
    id: "benzoyl_peroxide",
    label: "Benzoyl peroxide",
    aliases: ["benzoyl", "bpo"],
    targetConcerns: ["acne", "redness"],
    onsetDays: 14,
    assessAtDays: 56,
    citation:
      "Benzoyl peroxide registrational acne trials use a 12-week primary endpoint with lesion counts from week 2.",
  },
  {
    id: "azelaic_acid",
    label: "Azelaic acid",
    aliases: ["azelaic"],
    targetConcerns: ["redness", "acne", "age_spot"],
    onsetDays: 28,
    assessAtDays: 84,
    citation:
      "Azelaic acid rosacea and pigmentation trials report primary endpoints at 12 weeks.",
  },
  {
    id: "aha",
    label: "Glycolic or lactic acid (AHA)",
    aliases: ["glycolic", "lactic", "mandelic", "aha", "alpha hydroxy"],
    targetConcerns: ["texture", "radiance", "age_spot"],
    onsetDays: 14,
    assessAtDays: 56,
    citation:
      "Alpha hydroxy acid photoaging studies report texture and pigment change over 8-12 weeks.",
  },
  {
    id: "humectant",
    label: "Hyaluronic acid or glycerin (humectant)",
    aliases: ["hyaluronic", "glycerin", "glycerol", "sodium pca", "humectant"],
    targetConcerns: ["moisture"],
    onsetDays: 1,
    assessAtDays: 14,
    citation:
      "Humectant corneometry studies show hydration change within hours, sustained by 2 weeks.",
  },
  {
    id: "ceramide",
    label: "Ceramides or barrier repair",
    aliases: ["ceramide", "barrier", "cholesterol", "squalane", "panthenol"],
    targetConcerns: ["moisture", "redness"],
    onsetDays: 7,
    assessAtDays: 28,
    citation:
      "Barrier repair emollient trials report TEWL and hydration recovery over 2-4 weeks.",
  },
  {
    id: "peptide",
    label: "Peptides",
    aliases: ["peptide", "matrixyl", "argireline", "copper tripeptide"],
    targetConcerns: ["firmness", "wrinkle", "texture"],
    onsetDays: 56,
    assessAtDays: 84,
    citation:
      "Topical peptide firmness and wrinkle endpoints are conventionally assessed at 12 weeks.",
  },
  {
    id: "tranexamic_acid",
    label: "Tranexamic acid",
    aliases: ["tranexamic"],
    targetConcerns: ["age_spot", "radiance", "redness"],
    onsetDays: 28,
    assessAtDays: 84,
    citation:
      "Topical tranexamic acid melasma trials report primary endpoints at 8-12 weeks.",
  },
  {
    id: "sunscreen",
    label: "Sunscreen",
    aliases: ["spf", "sunscreen", "sunblock", "uv filter"],
    targetConcerns: ["age_spot", "redness", "wrinkle"],
    onsetDays: 56,
    assessAtDays: 168,
    citation:
      "Hughes et al., Ann Intern Med 2013;158(11):781-90, daily sunscreen photoaging benefit demonstrated over 4.5 years; short studies cannot show it.",
  },
];

/** Recognise actives named in a free-text product description. */
export function detectActives(productName: string): Active[] {
  const haystack = productName.toLowerCase();
  return ACTIVES.filter((active) =>
    active.aliases.some((alias) => haystack.includes(alias)),
  );
}

export function getActive(id: string): Active | undefined {
  return ACTIVES.find((a) => a.id === id);
}

/**
 * The concerns worth spending analysis units on for a given set of actives,
 * unioned with a small always-on safety set.
 *
 * Redness and acne are always requested regardless of what is being tested,
 * because they are how an adverse reaction announces itself. A study of a
 * firming peptide still needs to notice that the user's face is becoming
 * inflamed.
 */
export function concernsForStudy(actives: readonly Active[]): ConcernId[] {
  const SAFETY_CONCERNS: ConcernId[] = ["redness", "acne"];
  const selected = new Set<ConcernId>(SAFETY_CONCERNS);
  for (const active of actives) {
    for (const concern of active.targetConcerns) selected.add(concern);
  }
  return [...selected];
}

/**
 * The day from which a flat result may be called a failure: the latest
 * assessment horizon across every active in the study.
 */
export function assessmentHorizonDays(actives: readonly Active[]): number {
  if (actives.length === 0) return 56;
  return Math.max(...actives.map((a) => a.assessAtDays));
}

/** Is `day` inside the expected purge window for this concern? */
export function isWithinPurgeWindow(
  actives: readonly Active[],
  concern: ConcernId,
  day: number,
): boolean {
  return actives.some(
    (a) =>
      a.purge !== undefined &&
      a.purge.concerns.includes(concern) &&
      day >= a.purge.startDay &&
      day <= a.purge.endDay,
  );
}
