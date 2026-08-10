/**
 * The statistics are the product. If these are wrong, Assay is lying to
 * people about whether their skincare works, which is worse than not building
 * it at all.
 *
 * Every expected value below is either hand-computed from the definition or
 * taken from a published table, never from a previous run of this code.
 */

import { describe, it, expect } from "vitest";

import {
  logGamma,
  incompleteBeta,
  studentTTwoSidedP,
  studentTCritical,
  normalQuantile,
} from "./distributions";

import {
  mean,
  variance,
  standardDeviation,
  pooledWithinSessionSd,
  betweenSessionSd,
  intraclassCorrelation,
  semFromReliability,
  minimalDetectableChange,
  estimateReliability,
  type Session,
} from "./reliability";

import { linearTrend, pairedTTest, projectPower } from "./inference";

describe("logGamma", () => {
  it("matches exact factorials", () => {
    // Γ(5) = 4! = 24
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    // Γ(8) = 7! = 5040
    expect(logGamma(8)).toBeCloseTo(Math.log(5040), 10);
  });

  it("matches Γ(1/2) = √π", () => {
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });

  it("rejects non-positive input", () => {
    expect(() => logGamma(0)).toThrow(RangeError);
    expect(() => logGamma(-1)).toThrow(RangeError);
  });
});

describe("incompleteBeta", () => {
  it("is 0 at x=0 and 1 at x=1", () => {
    expect(incompleteBeta(2, 3, 0)).toBe(0);
    expect(incompleteBeta(2, 3, 1)).toBe(1);
  });

  it("is symmetric: I_x(a,a) = 1/2 at x = 1/2", () => {
    expect(incompleteBeta(3, 3, 0.5)).toBeCloseTo(0.5, 10);
    expect(incompleteBeta(7.5, 7.5, 0.5)).toBeCloseTo(0.5, 10);
  });

  it("satisfies the reflection identity I_x(a,b) = 1 - I_{1-x}(b,a)", () => {
    const a = 2.5;
    const b = 4.5;
    const x = 0.3;
    expect(incompleteBeta(a, b, x)).toBeCloseTo(1 - incompleteBeta(b, a, 1 - x), 10);
  });
});

describe("studentTTwoSidedP", () => {
  // Critical values from any standard two-tailed t table.
  it("gives p ≈ 0.05 at the tabled 5% critical values", () => {
    expect(studentTTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(studentTTwoSidedP(2.086, 20)).toBeCloseTo(0.05, 3);
    expect(studentTTwoSidedP(2.042, 30)).toBeCloseTo(0.05, 3);
  });

  it("gives p ≈ 0.01 at the tabled 1% critical values", () => {
    expect(studentTTwoSidedP(3.169, 10)).toBeCloseTo(0.01, 3);
    expect(studentTTwoSidedP(2.845, 20)).toBeCloseTo(0.01, 3);
  });

  it("returns 1 at t = 0 and is symmetric in the sign of t", () => {
    expect(studentTTwoSidedP(0, 12)).toBeCloseTo(1, 10);
    expect(studentTTwoSidedP(-2.5, 15)).toBeCloseTo(studentTTwoSidedP(2.5, 15), 12);
  });

  it("approaches the normal tail for large df", () => {
    expect(studentTTwoSidedP(1.959964, 100000)).toBeCloseTo(0.05, 4);
  });
});

describe("studentTCritical", () => {
  it("recovers tabled critical values", () => {
    expect(studentTCritical(0.05, 10)).toBeCloseTo(2.228, 2);
    expect(studentTCritical(0.05, 20)).toBeCloseTo(2.086, 2);
    expect(studentTCritical(0.01, 10)).toBeCloseTo(3.169, 2);
  });

  it("round-trips against the p-value function", () => {
    const critical = studentTCritical(0.05, 7);
    expect(studentTTwoSidedP(critical, 7)).toBeCloseTo(0.05, 6);
  });
});

describe("normalQuantile", () => {
  it("matches published standard normal quantiles", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 10);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.959964, 5);
  });
});

describe("descriptive statistics", () => {
  it("computes mean and Bessel-corrected variance", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(values)).toBe(5);
    // Deviations squared sum to 32; sample variance divides by n-1 = 7.
    expect(variance(values)).toBeCloseTo(32 / 7, 12);
    expect(standardDeviation(values)).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  it("refuses a variance of one value rather than returning zero", () => {
    expect(() => variance([5])).toThrow(RangeError);
  });
});

/**
 * Shared fixture, hand-computable throughout.
 *
 *   Session A frames [10, 12] → mean 11, variance 2
 *   Session B frames [20, 22] → mean 21, variance 2
 *   Grand mean 16
 *   MSB = 2·((11−16)² + (21−16)²) / 1 = 100
 *   MSW = (1+1+1+1) / (2·1) = 2
 */
const FIXTURE: Session[] = [
  { id: "a", day: 0, frames: [10, 12] },
  { id: "b", day: 2, frames: [20, 22] },
];

describe("pooledWithinSessionSd", () => {
  it("pools within-session variances weighted by degrees of freedom", () => {
    // √((1·2 + 1·2) / 2) = √2
    expect(pooledWithinSessionSd(FIXTURE)).toBeCloseTo(Math.SQRT2, 12);
  });

  it("weights a session with more frames more heavily", () => {
    const sessions: Session[] = [
      { id: "a", day: 0, frames: [10, 10, 10, 10] }, // variance 0, df 3
      { id: "b", day: 1, frames: [0, 10] }, // variance 50, df 1
    ];
    // √((3·0 + 1·50) / 4) = √12.5
    expect(pooledWithinSessionSd(sessions)).toBeCloseTo(Math.sqrt(12.5), 12);
  });

  it("throws when no session has replicate frames, instead of assuming zero error", () => {
    const singles: Session[] = [
      { id: "a", day: 0, frames: [10] },
      { id: "b", day: 1, frames: [20] },
    ];
    expect(() => pooledWithinSessionSd(singles)).toThrow(RangeError);
  });
});

describe("intraclassCorrelation", () => {
  it("matches the hand-computed ICC(1,1)", () => {
    // (100 − 2) / (100 + 1·2) = 98/102
    expect(intraclassCorrelation(FIXTURE)).toBeCloseTo(98 / 102, 12);
  });

  it("is near 1 when sessions differ far more than frames within them", () => {
    const sessions: Session[] = [
      { id: "a", day: 0, frames: [10, 10.1] },
      { id: "b", day: 1, frames: [50, 50.1] },
      { id: "c", day: 2, frames: [90, 90.1] },
    ];
    expect(intraclassCorrelation(sessions)!).toBeGreaterThan(0.99);
  });

  it("truncates to 0 when within-session noise swamps between-session signal", () => {
    const sessions: Session[] = [
      { id: "a", day: 0, frames: [0, 100] },
      { id: "b", day: 1, frames: [100, 0] },
    ];
    expect(intraclassCorrelation(sessions)).toBe(0);
  });

  it("returns null for an unbalanced design rather than a misleading number", () => {
    const unbalanced: Session[] = [
      { id: "a", day: 0, frames: [10, 12] },
      { id: "b", day: 1, frames: [20, 22, 24] },
    ];
    expect(intraclassCorrelation(unbalanced)).toBeNull();
  });

  it("returns null with fewer than two usable sessions", () => {
    expect(intraclassCorrelation([{ id: "a", day: 0, frames: [1, 2] }])).toBeNull();
  });
});

describe("minimal detectable change", () => {
  it("applies MDC95 = 1.96 × √2 × SEM", () => {
    expect(minimalDetectableChange(3)).toBeCloseTo(1.96 * Math.SQRT2 * 3, 12);
    // 1.96 × 1.4142136 × 3 = 8.31558
    expect(minimalDetectableChange(3)).toBeCloseTo(8.31558, 4);
  });

  it("shrinks by √k when comparing means of k replicate frames", () => {
    const single = minimalDetectableChange(6, 1);
    const triple = minimalDetectableChange(6, 3);
    expect(triple).toBeCloseTo(single / Math.sqrt(3), 12);
    // Three frames instead of one lowers the floor by about 42%.
    expect(1 - triple / single).toBeCloseTo(0.4226, 3);
  });

  it("rejects fewer than one replicate", () => {
    expect(() => minimalDetectableChange(3, 0)).toThrow(RangeError);
  });
});

describe("semFromReliability", () => {
  it("applies SEM = SD × √(1 − r)", () => {
    expect(semFromReliability(10, 0.75)).toBeCloseTo(5, 12);
    expect(semFromReliability(10, 1)).toBe(0);
  });

  it("rejects a reliability outside [0, 1]", () => {
    expect(() => semFromReliability(10, 1.2)).toThrow(RangeError);
  });
});

describe("betweenSessionSd", () => {
  it("measures the spread of session means, not of frames", () => {
    // FIXTURE session means are 11 and 21; SD of two values is |diff|/√2.
    expect(betweenSessionSd(FIXTURE)).toBeCloseTo(10 / Math.SQRT2, 12);
  });

  it("returns null with fewer than two sessions", () => {
    expect(betweenSessionSd([FIXTURE[0]])).toBeNull();
  });
});

describe("estimateReliability", () => {
  it("prefers the between-session floor when repositioning error dominates", () => {
    // FIXTURE sessions sit 10 points apart while frames within them differ by 2.
    // Repositioning error dominates, so that is the floor a verdict must clear.
    const estimate = estimateReliability(FIXTURE);

    const between = 10 / Math.SQRT2; // 7.071
    expect(estimate.basis).toBe("between-session");
    expect(estimate.underestimates).toBe(false);
    expect(estimate.sem).toBeCloseTo(between, 12);
    expect(estimate.mdc95SessionMean).toBeCloseTo(1.96 * Math.SQRT2 * between, 10);

    // mdc95Single still reports frame-level error, computed from within-session data.
    expect(estimate.mdc95Single).toBeCloseTo(3.92, 10);
    expect(estimate.framesPerSession).toBe(2);
    expect(estimate.frameCount).toBe(4);
    expect(estimate.sessionCount).toBe(2);
  });

  it("keeps the within-session floor when it is the larger of the two", () => {
    // Session means cluster tightly while frames scatter widely. The
    // between-session SD is the right concept but a noisy estimate from three
    // sessions, and deferring to it here would claim precision the frames do
    // not support.
    const sessions: Session[] = [
      { id: "a", day: 0, frames: [42, 50, 58] },
      { id: "b", day: 0, frames: [43, 50, 57] },
      { id: "c", day: 0, frames: [41, 50, 59] },
    ];

    const estimate = estimateReliability(sessions);
    const withinDerived = pooledWithinSessionSd(sessions) / Math.sqrt(3);

    expect(estimate.basis).toBe("within-session");
    expect(estimate.mdc95SessionMean).toBeCloseTo(1.96 * Math.SQRT2 * withinDerived, 10);
  });

  it("flags a single calibration session as an underestimate", () => {
    // One session cannot observe repositioning error at all, so the floor it
    // yields is a known lower bound and the UI has to say so.
    const estimate = estimateReliability([{ id: "only", day: 0, frames: [50, 51, 49] }]);

    expect(estimate.basis).toBe("within-session");
    expect(estimate.underestimates).toBe(true);
  });
});

describe("linearTrend", () => {
  /**
   * Hand-computed fixture:
   *   x = [0, 2, 4, 6, 8], y = [50, 52, 53, 56, 59]
   *   Sxx = 40, Sxy = 44 → slope 1.1, intercept 49.6
   *   residuals [0.4, 0.2, −1.0, −0.2, 0.6] → RSS 1.6, df 3
   *   SE(slope) = √(0.53333/40) = 0.115470
   *   t = 1.1 / 0.115470 = 9.5261
   *   Syy = 50 → R² = 1 − 1.6/50 = 0.968
   */
  const x = [0, 2, 4, 6, 8];
  const y = [50, 52, 53, 56, 59];

  it("recovers the hand-computed slope, intercept and error", () => {
    const trend = linearTrend(x, y);
    expect(trend.slopePerDay).toBeCloseTo(1.1, 12);
    expect(trend.intercept).toBeCloseTo(49.6, 12);
    expect(trend.slopeStandardError).toBeCloseTo(0.1154700538, 8);
    expect(trend.residualSd).toBeCloseTo(Math.sqrt(1.6 / 3), 12);
    expect(trend.df).toBe(3);
    expect(trend.n).toBe(5);
  });

  it("recovers the hand-computed t statistic and R²", () => {
    const trend = linearTrend(x, y);
    expect(trend.t).toBeCloseTo(9.5261, 3);
    expect(trend.rSquared).toBeCloseTo(0.968, 10);
    expect(trend.p).toBeLessThan(0.01);
  });

  it("reports total change over the observed span with a CI that brackets it", () => {
    const trend = linearTrend(x, y);
    expect(trend.spanDays).toBe(8);
    expect(trend.totalChange).toBeCloseTo(8.8, 12);
    expect(trend.totalChangeCi[0]).toBeLessThan(trend.totalChange);
    expect(trend.totalChangeCi[1]).toBeGreaterThan(trend.totalChange);
  });

  it("treats a perfect fit as maximally significant, not as null", () => {
    const trend = linearTrend([0, 1, 2, 3], [1, 3, 5, 7]);
    expect(trend.slopePerDay).toBeCloseTo(2, 12);
    expect(trend.p).toBe(0);
    expect(trend.t).toBe(Number.POSITIVE_INFINITY);
  });

  it("reports flat data as null", () => {
    const trend = linearTrend([0, 1, 2, 3], [5, 5, 5, 5]);
    expect(trend.slopePerDay).toBeCloseTo(0, 12);
    expect(trend.p).toBe(1);
  });

  it("finds no significant trend in symmetric noise", () => {
    const trend = linearTrend([0, 2, 4, 6, 8, 10], [50, 54, 48, 52, 49, 53]);
    expect(trend.p).toBeGreaterThan(0.2);
  });

  it("requires three sessions and two distinct days", () => {
    expect(() => linearTrend([0, 1], [1, 2])).toThrow(RangeError);
    expect(() => linearTrend([3, 3, 3], [1, 2, 3])).toThrow(RangeError);
    expect(() => linearTrend([0, 1, 2], [1, 2])).toThrow(RangeError);
  });
});

describe("pairedTTest", () => {
  /**
   * Textbook paired design.
   *   differences = [−9, −4, −21, −3, −20, −31, −17, −23]
   *   mean −16, SD 9.8416, SE 3.4796, t = −4.598, df 7
   */
  const before = [200, 174, 198, 170, 179, 182, 193, 209];
  const after = [191, 170, 177, 167, 159, 151, 176, 186];

  it("recovers the hand-computed mean difference and t", () => {
    const result = pairedTTest(before, after);
    expect(result.meanDifference).toBeCloseTo(-16, 12);
    expect(result.t).toBeCloseTo(-4.5983, 3);
    expect(result.df).toBe(7);
    expect(result.p).toBeCloseTo(0.0025, 3);
  });

  it("produces a CI that excludes zero for a significant effect", () => {
    const result = pairedTTest(before, after);
    expect(result.ci[1]).toBeLessThan(0);
  });

  it("computes Cohen's d for paired samples", () => {
    const result = pairedTTest(before, after);
    expect(result.cohensD).toBeCloseTo(-16 / 9.8416, 3);
  });

  it("treats a perfectly consistent shift as significant, not null", () => {
    const result = pairedTTest([10, 20, 30], [15, 25, 35]);
    expect(result.meanDifference).toBeCloseTo(5, 12);
    expect(result.p).toBe(0);
  });

  it("finds nothing when there is nothing", () => {
    const result = pairedTTest([10, 20, 30, 40], [11, 19, 31, 39]);
    expect(result.p).toBeGreaterThan(0.5);
  });

  it("rejects mismatched or too-short samples", () => {
    expect(() => pairedTTest([1, 2], [1])).toThrow(RangeError);
    expect(() => pairedTTest([1], [2])).toThrow(RangeError);
  });
});

describe("projectPower", () => {
  const base = {
    residualSd: 4,
    cadenceDays: 2,
    targetChange: 5,
  };

  it("reports how many more sessions are needed when underpowered", () => {
    const projection = projectPower({ ...base, currentSessions: 3 });
    expect(projection.alreadyPowered).toBe(false);
    expect(projection.additionalSessions).toBeGreaterThan(0);
    expect(projection.additionalDays).toBe(projection.additionalSessions! * 2);
  });

  it("reaches the target and stops asking for more", () => {
    const needed = projectPower({ ...base, currentSessions: 3 }).additionalSessions!;
    const after = projectPower({ ...base, currentSessions: 3 + needed });
    expect(after.alreadyPowered).toBe(true);
    expect(after.additionalSessions).toBeNull();
  });

  it("detects smaller changes as sessions accumulate", () => {
    const at5 = projectPower({ ...base, currentSessions: 5 }).detectableNow;
    const at10 = projectPower({ ...base, currentSessions: 10 }).detectableNow;
    const at20 = projectPower({ ...base, currentSessions: 20 }).detectableNow;
    expect(at10).toBeLessThan(at5);
    expect(at20).toBeLessThan(at10);
  });

  it("can detect less on a noisier instrument, given the same data", () => {
    const quiet = projectPower({ ...base, residualSd: 2, currentSessions: 5 });
    const noisy = projectPower({ ...base, residualSd: 8, currentSessions: 5 });
    expect(noisy.detectableNow).toBeGreaterThan(quiet.detectableNow);
  });

  it("needs more sessions when the instrument is noisier", () => {
    // Both arms must stay inside the session cap for the comparison to mean
    // anything: at residualSd 8 and a 5-point target the requirement runs past
    // 200 sessions and correctly reports null instead of a number.
    const quiet = projectPower({
      ...base,
      residualSd: 3,
      targetChange: 8,
      currentSessions: 3,
    });
    const noisy = projectPower({
      ...base,
      residualSd: 6,
      targetChange: 8,
      currentSessions: 3,
    });

    expect(quiet.additionalSessions).not.toBeNull();
    expect(noisy.additionalSessions).not.toBeNull();
    expect(noisy.additionalSessions!).toBeGreaterThan(quiet.additionalSessions!);
  });

  it("cannot resolve a target below the noise within the session cap", () => {
    const projection = projectPower({
      ...base,
      residualSd: 40,
      targetChange: 0.01,
      currentSessions: 3,
      maxSessions: 30,
    });
    expect(projection.additionalSessions).toBeNull();
    expect(projection.alreadyPowered).toBe(false);
  });

  it("rejects nonsensical inputs", () => {
    expect(() => projectPower({ ...base, currentSessions: 3, cadenceDays: 0 })).toThrow(
      RangeError,
    );
    expect(() => projectPower({ ...base, currentSessions: 3, targetChange: 0 })).toThrow(
      RangeError,
    );
  });
});
