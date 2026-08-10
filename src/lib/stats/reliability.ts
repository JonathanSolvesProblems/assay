/**
 * Reliability statistics: the part of Assay that makes a skin score
 * mean something.
 *
 * The problem this solves: a single YouCam skin score is a measurement, and
 * every measurement carries error. Illumination, distance, and head pose all
 * move the number without the skin having changed at all. The dermatology
 * imaging literature is explicit that variation in illuminating light produces
 * image differences "not attributable to skin condition, thereby lessening the
 * probative value of digital imaging analysis."
 *
 * So before we report that a product worked, we estimate how much this
 * instrument moves on this face when nothing has changed, and require any
 * claimed change to clear that floor.
 *
 * Definitions used here are the standard ones from clinical measurement science:
 *
 *   SEM, standard error of measurement. Estimated directly as the pooled
 *           within-session standard deviation across replicate frames captured
 *           back to back, following Bland & Altman's within-subject SD method.
 *           Skin cannot change in the thirty seconds between frames, so all of
 *           that spread is instrument error.
 *
 *   ICC, intraclass correlation, one-way random effects, ICC(1,1). Reported
 *           as the reliability coefficient of the instrument on this subject.
 *
 *   MDC95, minimal detectable change at 95% confidence,
 *           MDC95 = 1.96 × √2 × SEM.
 *           The √2 accounts for the error present in *both* measurements being
 *           compared. This is the bar a change has to clear to be called real.
 *
 * References:
 *   Bland JM, Altman DG. "Measurement error." BMJ 1996;313:744.
 *   Weir JP. "Quantifying test-retest reliability using the intraclass
 *     correlation coefficient and the SEM." J Strength Cond Res 2005;19(1):231-40.
 *   Shrout PE, Fleiss JL. "Intraclass correlations: uses in assessing rater
 *     reliability." Psychol Bull 1979;86(2):420-8.
 */

/** One capture session: k frames shot back to back, scored on the same concern. */
export interface Session {
  /** Stable identifier for the session. */
  id: string;
  /** Days elapsed since the study baseline. Baseline session is day 0. */
  day: number;
  /** Raw per-frame scores for a single concern, one entry per frame. */
  frames: number[];
}

/**
 * Where a concern's readings sit relative to the bounds of the 0-100 scale.
 *
 * This exists because of a trap found while characterising the instrument. On a
 * face with no visible redness the API returned 100.00 for redness on every
 * variant, including a plus and minus 8% illumination sweep. Read naively that
 * is a perfect noise floor of zero, which would make redness look like the most
 * trustworthy metric available.
 *
 * It is the opposite. A reading pinned to the top of its range cannot move
 * upward, so it cannot show improvement, and its zero variance is a ceiling
 * artefact rather than precision. Reporting a tight error bar for a measurement
 * that is not measuring anything would be the single most misleading thing this
 * app could do.
 */
export type Saturation = "none" | "ceiling" | "floor";

/** Bounds of the API's presentation scale. */
export const SCALE_MIN = 0;
export const SCALE_MAX = 100;

/**
 * How close to a bound counts as pinned, and how flat the readings must be.
 * A concern is only called saturated when it is both at the boundary and not
 * moving; a genuinely excellent score that still varies is not saturated.
 */
const SATURATION_MARGIN = 0.75;
const SATURATION_MAX_SD = 0.25;

/**
 * Which error the noise floor was built from.
 *
 * This distinction decides whether a verdict is honest, and it is the subtlest
 * thing in the whole codebase.
 *
 * `within-session` uses the spread across replicate frames taken seconds apart
 * without touching the camera. That captures sensor and micro-pose noise, and
 * nothing else. It is an optimistic *lower bound* on the real error.
 *
 * `between-session` uses the spread of session means across several calibration
 * sessions captured the same day, with the camera taken down and set back up in
 * between. That additionally captures repositioning and framing error, and
 * cropping alone was measured to move a texture score by 5.81 points, larger
 * than a realistic four-week treatment effect.
 *
 * Since a verdict compares one session against another, `between-session` is the
 * error that actually applies. Reporting a within-session floor for a
 * between-session comparison would let repositioning masquerade as a result.
 */
export type FloorBasis = "within-session" | "between-session";

export interface ReliabilityEstimate {
  /** Standard error of measurement, in score points. */
  sem: number;
  /** What the floor was estimated from. */
  basis: FloorBasis;
  /**
   * True when the floor is a known underestimate: one calibration session, so
   * repositioning error could not be observed. The UI must say so.
   */
  underestimates: boolean;
  /** Whether the readings are pinned against a bound of the scale. */
  saturation: Saturation;
  /** Intraclass correlation ICC(1,1), or null when it is not estimable. */
  icc: number | null;
  /** Minimal detectable change for a comparison of two single frames. */
  mdc95Single: number;
  /**
   * Minimal detectable change for a comparison of two session means.
   * This is the bar Assay actually applies, because every session is
   * the average of k frames. Averaging shrinks the floor by √k.
   */
  mdc95SessionMean: number;
  /** Frames per session assumed by `mdc95SessionMean`. */
  framesPerSession: number;
  /** Total frames that went into the estimate. */
  frameCount: number;
  /** Sessions that contributed replicate frames. */
  sessionCount: number;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("mean requires at least one value");
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample variance, Bessel-corrected (n − 1). */
export function variance(values: readonly number[]): number {
  if (values.length < 2) {
    throw new RangeError("variance requires at least two values");
  }
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
}

export function standardDeviation(values: readonly number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Pooled within-session standard deviation, our direct estimate of the SEM.
 *
 * Pools the within-session variances weighted by their degrees of freedom, so
 * sessions with more frames count for more:
 *
 *   s_w = √( Σ (k_i − 1) · s_i²  /  Σ (k_i − 1) )
 */
export function pooledWithinSessionSd(sessions: readonly Session[]): number {
  let weightedVarianceSum = 0;
  let totalDegreesOfFreedom = 0;

  for (const session of sessions) {
    if (session.frames.length < 2) continue;
    const df = session.frames.length - 1;
    weightedVarianceSum += df * variance(session.frames);
    totalDegreesOfFreedom += df;
  }

  if (totalDegreesOfFreedom === 0) {
    throw new RangeError(
      "Cannot estimate measurement error: no session contains two or more frames. " +
        "Assay requires replicate frames per session to calibrate.",
    );
  }

  return Math.sqrt(weightedVarianceSum / totalDegreesOfFreedom);
}

/**
 * ICC(1,1), one-way random effects, single measurement.
 *
 *   ICC = (MSB − MSW) / (MSB + (k − 1) · MSW)
 *
 * Requires a balanced design (equal frames per session); returns null when the
 * design is unbalanced or there are too few sessions for the estimate to mean
 * anything. A negative point estimate is truncated to 0, which is conventional:
 * it indicates between-session variance below the noise level, not a negative
 * correlation.
 */
export function intraclassCorrelation(sessions: readonly Session[]): number | null {
  const usable = sessions.filter((s) => s.frames.length >= 2);
  if (usable.length < 2) return null;

  const k = usable[0].frames.length;
  if (!usable.every((s) => s.frames.length === k)) return null;

  const n = usable.length;
  const sessionMeans = usable.map((s) => mean(s.frames));
  const grandMean = mean(usable.flatMap((s) => s.frames));

  // Between-session mean square.
  const ssBetween = k * sessionMeans.reduce((sum, m) => sum + (m - grandMean) ** 2, 0);
  const msBetween = ssBetween / (n - 1);

  // Within-session mean square.
  let ssWithin = 0;
  for (const session of usable) {
    const m = mean(session.frames);
    ssWithin += session.frames.reduce((sum, v) => sum + (v - m) ** 2, 0);
  }
  const msWithin = ssWithin / (n * (k - 1));

  const denominator = msBetween + (k - 1) * msWithin;
  if (denominator === 0) return null;

  const icc = (msBetween - msWithin) / denominator;
  return Math.max(0, Math.min(1, icc));
}

/**
 * Alternative SEM estimator for when replicate frames are unavailable and only
 * a reliability coefficient is known: SEM = SD × √(1 − r).
 *
 * Kept because it is the formula most readers will recognise, and because it
 * cross-checks the direct estimate. `pooledWithinSessionSd` is preferred when
 * replicates exist, since it needs no reliability assumption.
 */
export function semFromReliability(sd: number, reliability: number): number {
  if (reliability < 0 || reliability > 1) {
    throw new RangeError(
      `semFromReliability requires 0 <= r <= 1, received ${reliability}`,
    );
  }
  return sd * Math.sqrt(1 - reliability);
}

/**
 * Minimal detectable change at 95% confidence.
 *
 *   MDC95 = 1.96 × √2 × SEM
 *
 * `replicatesPerMeasurement` divides the SEM by √k, because averaging k frames
 * reduces the standard error of the session mean by that factor. Capturing
 * three frames instead of one lowers the detection floor by about 42%.
 */
export function minimalDetectableChange(
  sem: number,
  replicatesPerMeasurement = 1,
): number {
  if (sem < 0) throw new RangeError(`minimalDetectableChange requires sem >= 0`);
  if (replicatesPerMeasurement < 1) {
    throw new RangeError("replicatesPerMeasurement must be at least 1");
  }
  return 1.96 * Math.SQRT2 * (sem / Math.sqrt(replicatesPerMeasurement));
}

/**
 * Detect a concern pinned against either bound of the scale.
 *
 * Requires both conditions: the readings sit within `SATURATION_MARGIN` of a
 * bound, and they barely move. A score of 99.2 that still varies by two points
 * between frames is measuring something and is not saturated.
 */
export function detectSaturation(values: readonly number[]): Saturation {
  if (values.length === 0) return "none";

  const average = mean(values);
  const spread = values.length >= 2 ? standardDeviation(values) : 0;
  if (spread > SATURATION_MAX_SD) return "none";

  if (average >= SCALE_MAX - SATURATION_MARGIN) return "ceiling";
  if (average <= SCALE_MIN + SATURATION_MARGIN) return "floor";
  return "none";
}

/**
 * Standard deviation of session means: the error that applies when comparing
 * one session against another, including everything that changes between them.
 *
 * Only meaningful across calibration sessions captured close enough together
 * that the skin genuinely has not changed. Given that, all of this spread is
 * measurement error, and it is the honest floor for a day-to-day comparison.
 */
export function betweenSessionSd(sessions: readonly Session[]): number | null {
  const means = sessions.filter((s) => s.frames.length > 0).map((s) => mean(s.frames));
  if (means.length < 2) return null;
  return standardDeviation(means);
}

/**
 * Full reliability profile for one concern.
 *
 * Prefers a between-session floor whenever the calibration contains more than
 * one session, because that is the comparison a verdict actually makes. Falls
 * back to the within-session floor otherwise, and flags it as an underestimate
 * so nothing downstream can present it as the whole error.
 */
export function estimateReliability(sessions: readonly Session[]): ReliabilityEstimate {
  const usable = sessions.filter((s) => s.frames.length >= 2);
  const framesPerSession =
    usable.length > 0 ? Math.round(mean(usable.map((s) => s.frames.length))) : 1;

  const withinSem = pooledWithinSessionSd(sessions);
  const between = betweenSessionSd(sessions);

  // Standard error of a session mean, from the within-session data alone.
  const withinDerived = withinSem / Math.sqrt(framesPerSession);

  // Take whichever error is larger, never the smaller.
  //
  // The between-session SD measures the right thing: it includes repositioning
  //, but estimated from a handful of calibration sessions it is itself very
  // noisy, and can land below the within-session data by chance. Deferring to it
  // then would claim a precision the frames do not support.
  //
  // Conversely the within-session figure is blind to repositioning entirely. So
  // the floor is the maximum: repositioning error is honoured when it dominates,
  // and the frame-level error is honoured when the session count is too small to
  // trust. Both are lower bounds on the truth, and the larger lower bound is the
  // defensible one.
  const useBetween = between !== null && between > withinDerived;
  const sessionMeanSe = useBetween ? between : withinDerived;

  const sem = useBetween ? between : withinSem;
  const sessionMeanFloor = 1.96 * Math.SQRT2 * sessionMeanSe;

  return {
    sem,
    basis: useBetween ? "between-session" : "within-session",
    underestimates: !useBetween,
    saturation: detectSaturation(sessions.flatMap((s) => s.frames)),
    icc: intraclassCorrelation(sessions),
    mdc95Single: minimalDetectableChange(withinSem, 1),
    mdc95SessionMean: sessionMeanFloor,
    framesPerSession,
    frameCount: sessions.reduce((sum, s) => sum + s.frames.length, 0),
    sessionCount: usable.length,
  };
}
