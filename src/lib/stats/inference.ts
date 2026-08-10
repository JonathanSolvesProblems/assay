/**
 * Inferential statistics for the verdict and the panel view.
 *
 * Two tests do the work:
 *
 *   1. A least-squares trend over every session, testing whether the slope of
 *      score against day differs from zero. This uses all the data rather than
 *      just the endpoints, so it is far more powerful than a first-versus-last
 *      comparison and much harder to fool with one bad capture.
 *
 *   2. A paired t-test, used in the panel view where each subject contributes a
 *      before and an after. Pairing removes between-subject variation, which is
 *      why split-face and before/after designs dominate dermatology trials.
 *
 * The power calculation is what lets Assay say "not enough evidence yet,
 * come back in four sessions" instead of leaving the user with a shrug.
 */

import { mean, standardDeviation } from "./reliability";
import { studentTCritical, studentTTwoSidedP, normalQuantile } from "./distributions";

export interface TrendResult {
  /** Change in score points per day. */
  slopePerDay: number;
  /** Standard error of the slope. */
  slopeStandardError: number;
  /** Intercept at day 0. */
  intercept: number;
  /** t statistic for H0: slope = 0. */
  t: number;
  /** Degrees of freedom, n − 2. */
  df: number;
  /** Two-sided p-value. */
  p: number;
  /** Total modelled change across the observed span, slope × span. */
  totalChange: number;
  /** 95% confidence interval on `totalChange`. */
  totalChangeCi: [number, number];
  /** Days between the first and last session. */
  spanDays: number;
  /** Proportion of variance explained. */
  rSquared: number;
  /** Residual standard deviation about the fitted line. */
  residualSd: number;
  n: number;
}

export interface PairedTestResult {
  meanDifference: number;
  /** 95% confidence interval on the mean difference. */
  ci: [number, number];
  t: number;
  df: number;
  p: number;
  /** Cohen's d for paired samples: mean difference over SD of differences. */
  cohensD: number;
  n: number;
}

export interface PowerProjection {
  /**
   * Additional sessions needed before an effect of `targetChange` would be
   * detectable at the configured alpha and power, or null when the target is
   * already detectable.
   */
  additionalSessions: number | null;
  /** Calendar days those sessions represent at the study's capture cadence. */
  additionalDays: number | null;
  /** Smallest total change the study can currently detect. */
  detectableNow: number;
  /** Whether the study is already powered for `targetChange`. */
  alreadyPowered: boolean;
}

/** Ordinary least squares of `y` on `x`, with inference on the slope. */
export function linearTrend(x: readonly number[], y: readonly number[]): TrendResult {
  if (x.length !== y.length) {
    throw new RangeError("linearTrend requires x and y of equal length");
  }
  const n = x.length;
  if (n < 3) {
    throw new RangeError(
      `linearTrend requires at least 3 sessions to estimate a slope and its error, received ${n}`,
    );
  }

  const xBar = mean(x);
  const yBar = mean(y);

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xBar;
    const dy = y[i] - yBar;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  if (sxx === 0) {
    throw new RangeError("linearTrend requires sessions on at least two distinct days");
  }

  const slope = sxy / sxx;
  const intercept = yBar - slope * xBar;

  // Residual sum of squares, then the standard error of the slope.
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * x[i];
    rss += (y[i] - predicted) ** 2;
  }
  const df = n - 2;
  const residualVariance = rss / df;
  const residualSd = Math.sqrt(residualVariance);
  const slopeStandardError = Math.sqrt(residualVariance / sxx);

  // A zero residual means the points sit exactly on a line. If the slope is
  // also zero the data are flat and there is nothing to detect; otherwise the
  // fit is perfect and the slope is as significant as it gets. Collapsing both
  // to t = 0 would report a perfect trend as null, which is backwards.
  let t: number;
  let p: number;
  if (slopeStandardError === 0) {
    t = slope === 0 ? 0 : Math.sign(slope) * Number.POSITIVE_INFINITY;
    p = slope === 0 ? 1 : 0;
  } else {
    t = slope / slopeStandardError;
    p = studentTTwoSidedP(t, df);
  }

  const spanDays = Math.max(...x) - Math.min(...x);
  const totalChange = slope * spanDays;
  const tCritical = studentTCritical(0.05, df);
  const totalChangeMargin = tCritical * slopeStandardError * spanDays;

  return {
    slopePerDay: slope,
    slopeStandardError,
    intercept,
    t,
    df,
    p,
    totalChange,
    totalChangeCi: [totalChange - totalChangeMargin, totalChange + totalChangeMargin],
    spanDays,
    rSquared: syy === 0 ? 0 : 1 - rss / syy,
    residualSd,
    n,
  };
}

/** Paired t-test on before/after measurements. */
export function pairedTTest(
  before: readonly number[],
  after: readonly number[],
): PairedTestResult {
  if (before.length !== after.length) {
    throw new RangeError("pairedTTest requires equal-length samples");
  }
  const n = before.length;
  if (n < 2) {
    throw new RangeError(`pairedTTest requires at least 2 pairs, received ${n}`);
  }

  const differences = after.map((a, i) => a - before[i]);
  const meanDifference = mean(differences);
  const sdDifference = standardDeviation(differences);

  const standardError = sdDifference / Math.sqrt(n);
  const df = n - 1;

  // Identical differences across every pair give zero spread. A constant
  // non-zero shift is a perfectly consistent effect, not a null one.
  let t: number;
  let p: number;
  if (standardError === 0) {
    t = meanDifference === 0 ? 0 : Math.sign(meanDifference) * Number.POSITIVE_INFINITY;
    p = meanDifference === 0 ? 1 : 0;
  } else {
    t = meanDifference / standardError;
    p = studentTTwoSidedP(t, df);
  }

  const tCritical = studentTCritical(0.05, df);
  const margin = tCritical * standardError;

  return {
    meanDifference,
    ci: [meanDifference - margin, meanDifference + margin],
    t,
    df,
    p,
    cohensD: sdDifference === 0 ? 0 : meanDifference / sdDifference,
    n,
  };
}

/**
 * How many more sessions until this study could detect a change of
 * `targetChange` points, at the given alpha and power?
 *
 * For a trend design with sessions spaced `cadenceDays` apart, the standard
 * error of the slope falls as the spread of capture days grows:
 *
 *   SE(slope) = s_resid / √(Σ (x_i − x̄)²)
 *
 * and for n evenly spaced sessions, Σ (x_i − x̄)² = cadence² · n(n² − 1)/12.
 * A total change of `targetChange` over the study span corresponds to a slope
 * of targetChange / (cadence · (n − 1)), so we search upward in n for the
 * first count at which the detectable change drops below the target.
 */
export function projectPower(options: {
  /** Residual SD about the trend line, in score points. */
  residualSd: number;
  /** Sessions captured so far. */
  currentSessions: number;
  /** Days between sessions. */
  cadenceDays: number;
  /** Total change we want to be able to detect, in score points. */
  targetChange: number;
  alpha?: number;
  power?: number;
  /** Cap the search so an unreachable target returns null rather than looping. */
  maxSessions?: number;
}): PowerProjection {
  const {
    residualSd,
    currentSessions,
    cadenceDays,
    targetChange,
    alpha = 0.05,
    power = 0.8,
    maxSessions = 200,
  } = options;

  if (cadenceDays <= 0) {
    throw new RangeError("projectPower requires a positive capture cadence");
  }
  if (targetChange <= 0) {
    throw new RangeError("projectPower requires a positive target change");
  }

  // Two-sided alpha plus one-sided power, the standard normal approximation.
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const multiplier = zAlpha + zBeta;

  /** Smallest total change detectable with n evenly spaced sessions. */
  const detectableAt = (n: number): number => {
    if (n < 3) return Number.POSITIVE_INFINITY;
    const sxx = cadenceDays ** 2 * ((n * (n * n - 1)) / 12);
    const slopeStandardError = residualSd / Math.sqrt(sxx);
    const spanDays = cadenceDays * (n - 1);
    return multiplier * slopeStandardError * spanDays;
  };

  const detectableNow = detectableAt(currentSessions);
  if (detectableNow <= targetChange) {
    return {
      additionalSessions: null,
      additionalDays: null,
      detectableNow,
      alreadyPowered: true,
    };
  }

  for (let n = Math.max(3, currentSessions + 1); n <= maxSessions; n++) {
    if (detectableAt(n) <= targetChange) {
      const additionalSessions = n - currentSessions;
      return {
        additionalSessions,
        additionalDays: additionalSessions * cadenceDays,
        detectableNow,
        alreadyPowered: false,
      };
    }
  }

  return {
    additionalSessions: null,
    additionalDays: null,
    detectableNow,
    alreadyPowered: false,
  };
}
