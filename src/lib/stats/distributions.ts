/**
 * Distribution functions needed to put honest p-values and confidence intervals
 * behind a verdict.
 *
 * We implement these directly rather than pulling a stats package because the
 * whole claim of this product is that the numbers are defensible. A reviewer
 * should be able to read the implementation and check it against a table.
 *
 * References:
 *   Lentz (1976), "Generating Bessel functions in Mie scattering calculations
 *     using continued fractions": the modified Lentz algorithm used for the
 *     continued fraction expansion of the incomplete beta function.
 *   Press et al., Numerical Recipes, 3rd ed., §6.4 (incomplete beta) and §6.1
 *     (log gamma).
 */

/** Lanczos approximation to ln Γ(x), accurate to ~15 significant digits for x > 0. */
export function logGamma(x: number): number {
  if (x <= 0 || !Number.isFinite(x)) {
    throw new RangeError(`logGamma requires x > 0, received ${x}`);
  }

  // Lanczos coefficients (g = 7, n = 9).
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    // Reflection formula: Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }

  const z = x - 1;
  let a = c[0];
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (z + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Continued-fraction expansion used by `incompleteBeta`, evaluated with the
 * modified Lentz algorithm. Converges rapidly for x < (a+1)/(a+b+2).
 */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAX_ITERATIONS = 300;
  const EPSILON = 3e-16;
  const TINY = 1e-300;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITERATIONS; m++) {
    const m2 = 2 * m;

    // Even step of the recurrence.
    let numerator = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;

    // Odd step of the recurrence.
    numerator = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < EPSILON) return h;
  }

  // Non-convergence here would mean a pathological input rather than a normal
  // one; surfacing it is better than silently returning a wrong p-value.
  throw new Error(
    `Incomplete beta continued fraction failed to converge for a=${a}, b=${b}, x=${x}`,
  );
}

/** Regularised incomplete beta function I_x(a, b). */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) {
    throw new RangeError(`incompleteBeta requires 0 <= x <= 1, received ${x}`);
  }
  if (x === 0) return 0;
  if (x === 1) return 1;

  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );

  // The continued fraction converges quickly only on one side of this pivot;
  // use the symmetry relation I_x(a,b) = 1 - I_{1-x}(b,a) on the other side.
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return (
    1 -
    (Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b) + b * Math.log(1 - x) + a * Math.log(x),
    ) *
      betaContinuedFraction(b, a, 1 - x)) /
      b
  );
}

/** Two-sided p-value for a Student's t statistic with `df` degrees of freedom. */
export function studentTTwoSidedP(t: number, df: number): number {
  if (df <= 0) {
    throw new RangeError(`studentTTwoSidedP requires df > 0, received ${df}`);
  }
  if (!Number.isFinite(t)) return 0;

  const x = df / (df + t * t);
  return incompleteBeta(df / 2, 0.5, x);
}

/**
 * Critical two-sided t value for a given alpha and df, found by bisection on
 * the p-value. Used to build confidence intervals.
 */
export function studentTCritical(alpha: number, df: number): number {
  if (alpha <= 0 || alpha >= 1) {
    throw new RangeError(`studentTCritical requires 0 < alpha < 1, received ${alpha}`);
  }

  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTTwoSidedP(mid, df) > alpha) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Standard normal quantile (inverse CDF), Acklam's rational approximation. */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new RangeError(`normalQuantile requires 0 < p < 1, received ${p}`);
  }

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}
