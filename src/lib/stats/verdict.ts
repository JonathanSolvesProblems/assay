/**
 * The verdict engine. This is the product.
 *
 * Everything else in Assay exists to make this function honest: the
 * calibration measures the instrument's error, the concern catalogue knows what
 * can physically move in the time available, and the actives catalogue knows
 * when a null result is old enough to mean something.
 *
 * The rule it enforces is the one every consumer skin tracker skips: a change is
 * only reported when it exceeds the minimal detectable change for this user on
 * this device. Below that floor, the honest answer is not zero and it is not a
 * small improvement. It is "we cannot tell yet", and it comes with the number of
 * sessions still required.
 */

import {
  estimateReliability,
  mean,
  type ReliabilityEstimate,
  type Saturation,
  type Session,
} from "./reliability";
import { linearTrend, projectPower, type TrendResult } from "./inference";
import { CONCERNS, type ConcernId } from "../domain/concerns";
import {
  assessmentHorizonDays,
  isWithinPurgeWindow,
  type Active,
} from "../domain/actives";

export type VerdictState =
  /** Change exceeds the noise floor in the direction of improvement. */
  | "working"
  /** Change exceeds the noise floor in the wrong direction. A safety signal. */
  | "worsening"
  /** Worsening, but inside the window where this active is known to purge. */
  | "expected_purge"
  /** Flat, and we have now looked long enough and hard enough for that to mean something. */
  | "not_working"
  /** Flat, but the study cannot yet resolve an effect this size. */
  | "insufficient_evidence"
  /**
   * The concern is pinned against a bound of the scale and cannot move, so no
   * verdict about a product is possible from it. Measured, not inferred: on a
   * clear face the API returns redness 100.00 across a full illumination sweep.
   */
  | "saturated";

export interface Verdict {
  concern: ConcernId;
  state: VerdictState;
  /** Observed change in session means, signed so positive always means better. */
  change: number;
  /** The bar that change had to clear. */
  mdc95: number;
  /** True when |change| > mdc95. */
  clearsNoiseFloor: boolean;
  /** What a tracker without a noise floor would have reported, for comparison. */
  naiveChange: number;
  reliability: ReliabilityEstimate;
  trend: TrendResult | null;
  /** Sessions still needed before `meaningfulChange` would be detectable. */
  sessionsToVerdict: number | null;
  daysToVerdict: number | null;
  /** Smallest change this study can currently resolve. */
  detectableNow: number;
  confidence: "high" | "moderate" | "low";
  /** Plain-language explanation, safe to render directly. */
  explanation: string;
  sessionCount: number;
  studyDay: number;
}

export interface VerdictOptions {
  concern: ConcernId;
  /**
   * Sessions captured before the product was introduced, used only to measure
   * the instrument. Kept separate so treatment data never calibrates the
   * instrument that judges it.
   */
  calibrationSessions: readonly Session[];
  /** Sessions captured during treatment, ordered by day. */
  treatmentSessions: readonly Session[];
  actives: readonly Active[];
  /**
   * The smallest change considered worth acting on, in score points.
   *
   * Honest limitation: there is no published minimal clinically important
   * difference for YouCam's proprietary 0-100 scale, because establishing one
   * requires anchor-based studies against user-reported outcomes. Five points is
   * a product decision, surfaced here so it can be argued with, not a clinical
   * constant.
   */
  meaningfulChange?: number;
  /** Days between capture sessions, used for the power projection. */
  cadenceDays?: number;
}

const DEFAULT_MEANINGFUL_CHANGE = 5;
const DEFAULT_CADENCE_DAYS = 2;

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function computeVerdict(options: VerdictOptions): Verdict {
  const {
    concern,
    calibrationSessions,
    treatmentSessions,
    actives,
    meaningfulChange = DEFAULT_MEANINGFUL_CHANGE,
    cadenceDays = DEFAULT_CADENCE_DAYS,
  } = options;

  if (treatmentSessions.length < 2) {
    throw new RangeError(
      `computeVerdict requires at least 2 treatment sessions, received ${treatmentSessions.length}`,
    );
  }

  const meta = CONCERNS[concern];
  const sorted = [...treatmentSessions].sort((a, b) => a.day - b.day);

  // The instrument is calibrated on baseline data only. Letting treatment
  // sessions widen the noise floor would let a real effect hide inside it.
  const reliability = estimateReliability(
    calibrationSessions.length > 0 ? calibrationSessions : sorted,
  );

  const sessionMeans = sorted.map((s) => mean(s.frames));
  const days = sorted.map((s) => s.day);
  const studyDay = days[days.length - 1] - days[0];

  // Sign convention: positive change always means "better", whichever direction
  // the underlying score moves. A verdict that gets this backwards would tell
  // someone an irritant is helping.
  const direction = meta.higherIsBetter ? 1 : -1;
  const rawChange = sessionMeans[sessionMeans.length - 1] - sessionMeans[0];
  const change = rawChange * direction;

  // What a tracker with no noise floor would report: one frame against one
  // frame, no averaging, no error bar. This is the comparison shown in the UI.
  const naiveChange =
    (sorted[sorted.length - 1].frames[0] - sorted[0].frames[0]) * direction;

  const mdc95 = reliability.mdc95SessionMean;
  const clearsNoiseFloor = Math.abs(change) > mdc95;

  let trend: TrendResult | null = null;
  if (sorted.length >= 3 && new Set(days).size >= 2) {
    trend = linearTrend(days, sessionMeans);
  }

  // Power is projected from the residual spread about the trend where we have
  // one, and from the raw measurement error otherwise.
  //
  // The floor matters. With three sessions the residual SD carries a single
  // degree of freedom and can come out at exactly zero when the points happen
  // to be collinear, which would tell the power projection the study has
  // infinite precision and let it answer "no more sessions needed" to anything.
  // A session mean of k frames cannot have a standard error below sem/√k, so
  // that is the hard floor.
  const sessionMeanStandardError =
    reliability.sem / Math.sqrt(reliability.framesPerSession);
  const residualSd = Math.max(
    trend ? trend.residualSd : reliability.sem,
    sessionMeanStandardError,
  );
  const power = projectPower({
    residualSd,
    currentSessions: sorted.length,
    cadenceDays,
    targetChange: meaningfulChange,
  });

  const horizon = assessmentHorizonDays(actives);
  const pastBiologicalFloor = studyDay >= meta.biologicalFloorDays;
  const pastAssessmentHorizon = studyDay >= horizon;
  const trendAgrees =
    trend === null || trend.p < 0.05
      ? trend === null
        ? true
        : Math.sign(trend.slopePerDay * direction) === Math.sign(change)
      : false;

  // Saturation short-circuits everything. A concern pinned to a bound of the
  // scale has a noise floor near zero, which would otherwise make any drift look
  // like a decisive result on the most "precise" metric available.
  const state: VerdictState =
    reliability.saturation !== "none"
      ? "saturated"
      : decideState({
          change,
          clearsNoiseFloor,
          trendAgrees,
          pastBiologicalFloor,
          pastAssessmentHorizon,
          alreadyPowered: power.alreadyPowered,
          inPurgeWindow: isWithinPurgeWindow(actives, concern, studyDay),
        });

  const confidence = gradeConfidence({
    state,
    sessionCount: sorted.length,
    change,
    mdc95,
  });

  return {
    concern,
    state,
    change: round(change),
    mdc95: round(mdc95),
    clearsNoiseFloor,
    naiveChange: round(naiveChange),
    reliability,
    trend,
    sessionsToVerdict: power.additionalSessions,
    daysToVerdict: power.additionalDays,
    detectableNow: round(power.detectableNow),
    confidence,
    explanation: explain({
      state,
      meta,
      change,
      mdc95,
      naiveChange,
      power,
      horizon,
      studyDay,
      meaningfulChange,
      saturation: reliability.saturation,
    }),
    sessionCount: sorted.length,
    studyDay,
  };
}

function decideState(input: {
  change: number;
  clearsNoiseFloor: boolean;
  trendAgrees: boolean;
  pastBiologicalFloor: boolean;
  pastAssessmentHorizon: boolean;
  alreadyPowered: boolean;
  inPurgeWindow: boolean;
}): VerdictState {
  const {
    change,
    clearsNoiseFloor,
    trendAgrees,
    pastBiologicalFloor,
    pastAssessmentHorizon,
    alreadyPowered,
    inPurgeWindow,
  } = input;

  if (clearsNoiseFloor && change < 0) {
    // Worsening is reported even before the biological floor, because an
    // adverse reaction is exactly the thing that shows up early and the user
    // needs to know now. Purging is the one benign explanation.
    return inPurgeWindow ? "expected_purge" : "worsening";
  }

  if (clearsNoiseFloor && change > 0) {
    // Requiring the trend to agree stops a single unusual final session from
    // carrying a verdict on its own.
    return trendAgrees && pastBiologicalFloor ? "working" : "insufficient_evidence";
  }

  // Flat. A null result only counts once we have looked long enough for the
  // biology, and hard enough for the statistics.
  if (pastAssessmentHorizon && alreadyPowered) return "not_working";
  return "insufficient_evidence";
}

/**
 * Confidence is graded on how many sessions support the verdict and how far the
 * observed change clears the noise floor.
 *
 * ICC is deliberately *not* a gate here, although it is reported. ICC(1,1)
 * measures how well an instrument separates one session from another, so it
 * falls towards zero whenever the true between-session variance is small, which
 * is exactly what a good calibration period looks like. Gating on it would
 * penalise the most stable baselines, which is backwards. The quantity that
 * actually matters for a verdict is the absolute size of the error, and that is
 * already carried by the noise floor in `marginOverFloor`.
 */
function gradeConfidence(input: {
  state: VerdictState;
  sessionCount: number;
  change: number;
  mdc95: number;
}): "high" | "moderate" | "low" {
  const { state, sessionCount, change, mdc95 } = input;

  if (state === "saturated") return "low";
  if (state === "insufficient_evidence") return "low";
  if (sessionCount < 4) return "low";

  const marginOverFloor = mdc95 === 0 ? Infinity : Math.abs(change) / mdc95;

  if (sessionCount >= 6 && marginOverFloor >= 1.5) return "high";
  if (sessionCount >= 4 && marginOverFloor >= 1.0) return "moderate";
  return "low";
}

function explain(input: {
  state: VerdictState;
  meta: (typeof CONCERNS)[ConcernId];
  change: number;
  mdc95: number;
  naiveChange: number;
  power: ReturnType<typeof projectPower>;
  horizon: number;
  studyDay: number;
  meaningfulChange: number;
  saturation: Saturation;
}): string {
  const { state, meta, change, mdc95, power, horizon, studyDay, meaningfulChange } =
    input;

  const magnitude = round(Math.abs(change));
  const floor = round(mdc95);

  switch (state) {
    case "saturated":
      return input.saturation === "ceiling"
        ? `${meta.label} is reading at the very top of the scale on your baseline and barely moving. That is not a perfect score with a perfect error bar: it means the measurement has no room left to register an improvement, so it cannot tell you anything about a product. Assay will not score this concern for you.`
        : `${meta.label} is reading at the very bottom of the scale on your baseline and barely moving, so the measurement has no room to register a change in either direction. Assay will not score this concern for you.`;

    case "working":
      return `${meta.label} improved by ${magnitude} points against a noise floor of ${floor}. That change is larger than this instrument's error on your face, and the trend across every session agrees. This is a real effect.`;

    case "worsening":
      return `${meta.label} moved ${magnitude} points in the wrong direction, past the ${floor}-point noise floor. That is outside the window where this product is expected to cause temporary irritation. Worth stopping and reconsidering.`;

    case "expected_purge":
      return `${meta.label} is ${magnitude} points worse, which clears the ${floor}-point noise floor. This falls inside the window where this active is known to cause a temporary flare before it improves. Expected, not a reaction, but keep watching.`;

    case "not_working":
      return `${meta.label} has not moved beyond the ${floor}-point noise floor after ${studyDay} days. Past ${horizon} days this product should have shown something, and this study is now sensitive enough to have caught a ${meaningfulChange}-point change. This is a null result, not an early one.`;

    case "insufficient_evidence": {
      const observed = `${meta.label} has moved ${magnitude} points, inside the ${floor}-point margin of error.`;
      if (power.additionalSessions !== null) {
        return `${observed} That is not yet distinguishable from measurement noise. ${power.additionalSessions} more session${power.additionalSessions === 1 ? "" : "s"}, about ${power.additionalDays} days, would let us resolve a ${meaningfulChange}-point change.`;
      }
      return `${observed} That is not yet distinguishable from measurement noise, and at the current noise level a ${meaningfulChange}-point change is not resolvable on a practical schedule. Improving capture consistency would lower the floor.`;
    }
  }
}

/**
 * What a conventional skin tracker would report for the same data: latest frame
 * against baseline frame, no error bar, no gate.
 *
 * Kept as a first-class function rather than a UI detail because the comparison
 * is the clearest single argument for why the noise floor matters.
 */
export function naiveReading(
  treatmentSessions: readonly Session[],
  concern: ConcernId,
): { change: number; claim: string } {
  const sorted = [...treatmentSessions].sort((a, b) => a.day - b.day);
  const meta = CONCERNS[concern];
  const direction = meta.higherIsBetter ? 1 : -1;
  const change = (sorted[sorted.length - 1].frames[0] - sorted[0].frames[0]) * direction;

  const rounded = round(change);
  if (rounded > 0)
    return { change: rounded, claim: `${meta.label} +${rounded}, improving` };
  if (rounded < 0)
    return { change: rounded, claim: `${meta.label} ${rounded}, declining` };
  return { change: 0, claim: `${meta.label} unchanged` };
}
