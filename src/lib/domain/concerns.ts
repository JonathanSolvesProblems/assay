/**
 * The fourteen skin concerns the YouCam Skin Analysis API scores, annotated
 * with what Assay needs to reason about them.
 *
 * Two annotations matter beyond the raw score:
 *
 *   `higherIsBetter`: the API returns a 0-100 ui_score where a higher number
 *     is a better result for that concern. Assay still carries the flag
 *     explicitly rather than assuming it globally, because a verdict that gets
 *     the sign wrong would tell someone an irritant is helping them.
 *
 *   `expectedVolatility`, how much this concern genuinely moves day to day for
 *     reasons that are not the product under test: sleep, hydration, hormones,
 *     time of day. This is not measurement error (that is the SEM, measured per
 *     user) but real biological variation, and it is why we never judge oiliness
 *     on a single session the way we might judge age spots.
 */

export type ConcernId =
  | "wrinkle"
  | "pore"
  | "texture"
  | "acne"
  | "moisture"
  | "oiliness"
  | "radiance"
  | "redness"
  | "dark_circle"
  | "eye_bag"
  | "firmness"
  | "age_spot"
  | "droopy_upper_eyelid"
  | "droopy_lower_eyelid";

export type Volatility = "low" | "moderate" | "high";

export interface Concern {
  id: ConcernId;
  label: string;
  /** One line a non-expert can read without a dermatology background. */
  description: string;
  higherIsBetter: boolean;
  expectedVolatility: Volatility;
  /**
   * Roughly how long a structural change to this concern takes to become
   * visible at all, in days, regardless of what is applied. Judging a wrinkle
   * score after ten days is not impatience, it is a category error: collagen
   * remodelling does not happen on that timescale.
   */
  biologicalFloorDays: number;
}

export const CONCERNS: Record<ConcernId, Concern> = {
  moisture: {
    id: "moisture",
    label: "Hydration",
    description: "How much water the surface layer of your skin is holding.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 1,
  },
  oiliness: {
    id: "oiliness",
    label: "Oiliness",
    description: "Sebum on the surface. Swings with time of day and heat.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 7,
  },
  redness: {
    id: "redness",
    label: "Redness",
    description:
      "Visible flushing and irritation. The first thing to move when something disagrees with you.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 3,
  },
  acne: {
    id: "acne",
    label: "Blemishes",
    description: "Active spots and inflammatory lesions.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 14,
  },
  radiance: {
    id: "radiance",
    label: "Radiance",
    description:
      "How evenly your skin reflects light. Highly sensitive to the light you photograph it in.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 14,
  },
  texture: {
    id: "texture",
    label: "Texture",
    description: "Surface smoothness and roughness.",
    higherIsBetter: true,
    expectedVolatility: "moderate",
    biologicalFloorDays: 21,
  },
  pore: {
    id: "pore",
    label: "Pores",
    description: "Visible pore size and density.",
    higherIsBetter: true,
    expectedVolatility: "moderate",
    biologicalFloorDays: 28,
  },
  dark_circle: {
    id: "dark_circle",
    label: "Dark circles",
    description: "Shadowing and discolouration under the eye.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 14,
  },
  eye_bag: {
    id: "eye_bag",
    label: "Eye bags",
    description: "Puffiness under the eye. Moves overnight with sleep and salt.",
    higherIsBetter: true,
    expectedVolatility: "high",
    biologicalFloorDays: 7,
  },
  age_spot: {
    id: "age_spot",
    label: "Dark spots",
    description: "Discrete areas of hyperpigmentation.",
    higherIsBetter: true,
    expectedVolatility: "low",
    biologicalFloorDays: 56,
  },
  wrinkle: {
    id: "wrinkle",
    label: "Lines and wrinkles",
    description: "Fine lines and deeper creases.",
    higherIsBetter: true,
    expectedVolatility: "low",
    biologicalFloorDays: 56,
  },
  firmness: {
    id: "firmness",
    label: "Firmness",
    description: "How tight and supported the skin looks.",
    higherIsBetter: true,
    expectedVolatility: "low",
    biologicalFloorDays: 84,
  },
  droopy_upper_eyelid: {
    id: "droopy_upper_eyelid",
    label: "Upper eyelid droop",
    description: "Sagging of the upper lid.",
    higherIsBetter: true,
    expectedVolatility: "low",
    biologicalFloorDays: 84,
  },
  droopy_lower_eyelid: {
    id: "droopy_lower_eyelid",
    label: "Lower eyelid droop",
    description: "Sagging beneath the eye.",
    higherIsBetter: true,
    expectedVolatility: "low",
    biologicalFloorDays: 84,
  },
};

export const ALL_CONCERN_IDS = Object.keys(CONCERNS) as ConcernId[];

/**
 * The concern set Assay requests by default.
 *
 * This is a deliberate cost decision as well as a scientific one. Analysis units
 * scale with the number of concerns requested, and every session spends units on
 * three frames. Requesting all fourteen when a study is testing a retinoid would
 * burn budget on eyelid droop, which cannot move inside a three-week window.
 * `concernsForStudy` narrows this further once a product is enrolled.
 */
export const DEFAULT_CONCERNS: ConcernId[] = [
  "texture",
  "redness",
  "moisture",
  "acne",
  "pore",
  "radiance",
];

/** Convert an SD concern id to its high-definition counterpart. */
export function toHdConcern(id: ConcernId): string {
  return `hd_${id}`;
}

/**
 * SD and HD concerns cannot be mixed in one request: the API rejects the call
 * with InvalidParameters. Callers pick a mode for the whole session.
 */
export function concernsForRequest(ids: readonly ConcernId[], hd: boolean): string[] {
  return hd ? ids.map(toHdConcern) : [...ids];
}
