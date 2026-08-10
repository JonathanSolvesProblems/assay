/**
 * Verdict engine tests.
 *
 * The failure mode that matters most here is a false positive: telling someone a
 * product works when the data cannot support it. Several of these tests exist
 * specifically to prove Assay stays quiet when it should: the negative
 * controls.
 */

import { describe, it, expect } from "vitest";

import { computeVerdict, naiveReading } from "./verdict";
import type { Session } from "./reliability";
import { getActive } from "../domain/actives";

const retinoid = getActive("retinoid")!;
const humectant = getActive("humectant")!;

/** Build a session whose frames sit around `center` with a fixed spread. */
function session(id: string, day: number, center: number, spread = 1): Session {
  return { id, day, frames: [center - spread, center, center + spread] };
}

/** A quiet instrument: frames within a session barely differ. */
const QUIET_CALIBRATION: Session[] = [
  session("c1", -4, 50, 0.5),
  session("c2", -2, 50.4, 0.5),
  session("c3", 0, 49.8, 0.5),
];

/** A noisy instrument: inconsistent capture, wide within-session spread. */
const NOISY_CALIBRATION: Session[] = [
  session("c1", -4, 50, 8),
  session("c2", -2, 52, 8),
  session("c3", 0, 48, 8),
];

describe("computeVerdict, working", () => {
  it("calls a large, consistent improvement real", () => {
    const treatment: Session[] = [
      session("t1", 0, 50, 0.5),
      session("t2", 14, 53, 0.5),
      session("t3", 28, 56, 0.5),
      session("t4", 42, 59, 0.5),
      session("t5", 56, 62, 0.5),
      session("t6", 70, 65, 0.5),
    ];

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
      cadenceDays: 14,
    });

    expect(verdict.state).toBe("working");
    expect(verdict.change).toBeCloseTo(15, 5);
    expect(verdict.clearsNoiseFloor).toBe(true);
    expect(verdict.confidence).toBe("high");
    expect(verdict.explanation).toContain("real effect");
  });

  it("will not call an improvement real before the concern can physically move", () => {
    // Wrinkle has a 56-day biological floor. Six days of data cannot support a
    // wrinkle verdict no matter how clean the numbers look.
    const treatment: Session[] = [
      session("t1", 0, 50, 0.5),
      session("t2", 2, 55, 0.5),
      session("t3", 4, 60, 0.5),
      session("t4", 6, 65, 0.5),
    ];

    const verdict = computeVerdict({
      concern: "wrinkle",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
    });

    expect(verdict.state).toBe("insufficient_evidence");
  });
});

describe("computeVerdict: the negative controls", () => {
  it("stays silent when a noisy instrument shows a change smaller than its own error", () => {
    const treatment: Session[] = [
      session("t1", 0, 50, 8),
      session("t2", 2, 52, 8),
      session("t3", 4, 51, 8),
      session("t4", 6, 53, 8),
    ];

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: NOISY_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
    });

    expect(verdict.state).toBe("insufficient_evidence");
    expect(verdict.clearsNoiseFloor).toBe(false);
    expect(verdict.explanation).toContain("measurement noise");
  });

  it("reports a lighting-sized swing as no change, where a naive tracker claims progress", () => {
    // This is the demo. Same face, two sessions, only the lighting differs.
    // The naive single-frame reading sees a big jump; the noise floor does not.
    const treatment: Session[] = [
      { id: "window", day: 0, frames: [44, 52, 48] },
      { id: "lamp", day: 0.007, frames: [53, 61, 57] },
    ];

    const verdict = computeVerdict({
      concern: "radiance",
      calibrationSessions: NOISY_CALIBRATION,
      treatmentSessions: treatment,
      actives: [],
    });

    const naive = naiveReading(treatment, "radiance");

    expect(naive.change).toBeGreaterThan(8);
    expect(naive.claim).toContain("improving");

    expect(verdict.clearsNoiseFloor).toBe(false);
    expect(verdict.state).toBe("insufficient_evidence");
  });

  it("tells the user how many more sessions it needs rather than shrugging", () => {
    const treatment: Session[] = [
      session("t1", 0, 50, 4),
      session("t2", 2, 50.5, 4),
      session("t3", 4, 51, 4),
    ];

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: NOISY_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
      cadenceDays: 2,
    });

    expect(verdict.state).toBe("insufficient_evidence");
    expect(verdict.sessionsToVerdict).toBeGreaterThan(0);
    expect(verdict.daysToVerdict).toBe(verdict.sessionsToVerdict! * 2);
    expect(verdict.explanation).toMatch(/more session/);
  });
});

describe("computeVerdict: not working", () => {
  it("calls a null result only after the assessment horizon, with adequate power", () => {
    // A humectant assessed at 14 days: flat data past the horizon on a quiet
    // instrument is a genuine failure, not an early one.
    const treatment: Session[] = Array.from({ length: 10 }, (_, i) =>
      session(`t${i}`, i * 2, 50 + (i % 2 === 0 ? 0.1 : -0.1), 0.3),
    );

    const verdict = computeVerdict({
      concern: "moisture",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [humectant],
      cadenceDays: 2,
    });

    expect(verdict.studyDay).toBeGreaterThanOrEqual(14);
    expect(verdict.state).toBe("not_working");
    expect(verdict.explanation).toContain("null result, not an early one");
  });

  it("refuses to call a retinoid a failure at three weeks", () => {
    // Same flat data, but a retinoid's assessment horizon is 84 days. Calling
    // this a failure would be scientifically wrong.
    const treatment: Session[] = Array.from({ length: 10 }, (_, i) =>
      session(`t${i}`, i * 2, 50 + (i % 2 === 0 ? 0.1 : -0.1), 0.3),
    );

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
      cadenceDays: 2,
    });

    expect(verdict.state).toBe("insufficient_evidence");
    expect(verdict.state).not.toBe("not_working");
  });
});

describe("computeVerdict, safety", () => {
  it("flags worsening that clears the noise floor", () => {
    const treatment: Session[] = [
      session("t1", 0, 60, 0.5),
      session("t2", 20, 55, 0.5),
      session("t3", 40, 50, 0.5),
      session("t4", 60, 45, 0.5),
    ];

    const verdict = computeVerdict({
      concern: "redness",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [],
      cadenceDays: 20,
    });

    expect(verdict.state).toBe("worsening");
    expect(verdict.change).toBeLessThan(0);
    expect(verdict.explanation).toContain("wrong direction");
  });

  it("distinguishes an expected retinoid purge from a genuine reaction", () => {
    // Identical worsening, inside the retinoid purge window (days 7-42).
    const treatment: Session[] = [
      session("t1", 10, 60, 0.5),
      session("t2", 18, 56, 0.5),
      session("t3", 26, 52, 0.5),
    ];

    const purging = computeVerdict({
      concern: "acne",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
      cadenceDays: 8,
    });

    expect(purging.state).toBe("expected_purge");
    expect(purging.explanation).toContain("temporary flare");

    // The same shape of worsening with no purging active is a reaction.
    const reacting = computeVerdict({
      concern: "acne",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [humectant],
      cadenceDays: 8,
    });

    expect(reacting.state).toBe("worsening");
  });

  it("reports worsening even before the concern's biological floor", () => {
    // An adverse reaction is exactly the thing that appears early. Suppressing
    // it for being "too soon" would be the dangerous choice.
    const treatment: Session[] = [
      session("t1", 0, 60, 0.5),
      session("t2", 1, 54, 0.5),
      session("t3", 2, 48, 0.5),
    ];

    const verdict = computeVerdict({
      concern: "redness",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [],
      cadenceDays: 1,
    });

    expect(verdict.state).toBe("worsening");
  });
});

/**
 * Saturation. These use the real numbers the API returned during instrument
 * characterisation: on a face with no visible redness it reported 100.00 across
 * a plus/minus 8% illumination sweep. Naively that is a flawless noise floor of
 * zero on the most trustworthy metric available. It is the opposite.
 */
describe("computeVerdict, saturation", () => {
  const PINNED_CALIBRATION: Session[] = [
    { id: "c1", day: -4, frames: [100, 100, 100] },
    { id: "c2", day: -2, frames: [100, 100, 100] },
    { id: "c3", day: 0, frames: [100, 100, 100] },
  ];

  it("refuses to score a concern pinned at the ceiling", () => {
    const treatment: Session[] = [
      { id: "t1", day: 0, frames: [100, 100, 100] },
      { id: "t2", day: 10, frames: [100, 100, 99.5] },
      { id: "t3", day: 20, frames: [99, 99, 99] },
    ];

    const verdict = computeVerdict({
      concern: "redness",
      calibrationSessions: PINNED_CALIBRATION,
      treatmentSessions: treatment,
      actives: [humectant],
      cadenceDays: 10,
    });

    expect(verdict.reliability.saturation).toBe("ceiling");
    expect(verdict.state).toBe("saturated");
    expect(verdict.explanation).toContain("no room");
    expect(verdict.confidence).toBe("low");
  });

  it("does not let a near-zero noise floor manufacture a decisive verdict", () => {
    // Without the saturation guard this is the dangerous case: SEM is ~0, so
    // MDC95 is ~0, and a one-point drift clears the floor and reads as a
    // confident result on a metric that cannot actually measure anything.
    const treatment: Session[] = [
      { id: "t1", day: 0, frames: [100, 100, 100] },
      { id: "t2", day: 20, frames: [98.5, 98.5, 98.5] },
      { id: "t3", day: 40, frames: [97, 97, 97] },
    ];

    const verdict = computeVerdict({
      concern: "redness",
      calibrationSessions: PINNED_CALIBRATION,
      treatmentSessions: treatment,
      actives: [],
      cadenceDays: 20,
    });

    expect(verdict.mdc95).toBeLessThan(1);
    expect(verdict.clearsNoiseFloor).toBe(true);
    // Clears the floor, but is still not reported as worsening.
    expect(verdict.state).toBe("saturated");
    expect(verdict.state).not.toBe("worsening");
  });

  it("detects a floor pin as well as a ceiling pin", () => {
    const atFloor: Session[] = [
      { id: "c1", day: -2, frames: [0, 0, 0] },
      { id: "c2", day: 0, frames: [0, 0, 0.1] },
    ];

    const verdict = computeVerdict({
      concern: "acne",
      calibrationSessions: atFloor,
      treatmentSessions: [
        { id: "t1", day: 0, frames: [0, 0, 0] },
        { id: "t2", day: 20, frames: [1, 1, 1] },
      ],
      actives: [],
      cadenceDays: 20,
    });

    expect(verdict.reliability.saturation).toBe("floor");
    expect(verdict.state).toBe("saturated");
    expect(verdict.explanation).toContain("either direction");
  });

  it("treats an excellent but still-moving score as measurable, not saturated", () => {
    // 99.2 with real spread is measuring something. Only pinned-and-flat counts.
    const high: Session[] = [
      { id: "c1", day: -2, frames: [97.5, 99.2, 98.1] },
      { id: "c2", day: 0, frames: [98.4, 97.1, 99.0] },
    ];

    const verdict = computeVerdict({
      concern: "redness",
      calibrationSessions: high,
      treatmentSessions: [
        { id: "t1", day: 0, frames: [98, 98.5, 97.6] },
        { id: "t2", day: 20, frames: [98.2, 97.9, 98.4] },
      ],
      actives: [],
      cadenceDays: 20,
    });

    expect(verdict.reliability.saturation).toBe("none");
    expect(verdict.state).not.toBe("saturated");
  });
});

describe("computeVerdict, mechanics", () => {
  it("never lets treatment data widen the noise floor that judges it", () => {
    const treatment: Session[] = [
      session("t1", 0, 50, 20),
      session("t2", 30, 62, 20),
      session("t3", 60, 74, 20),
    ];

    const calibrated = computeVerdict({
      concern: "texture",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
      cadenceDays: 30,
    });

    // Calibration came from the quiet baseline, so the floor stays tight even
    // though the treatment frames are wildly spread.
    expect(calibrated.mdc95).toBeLessThan(3);
    expect(calibrated.state).toBe("working");
  });

  it("falls back to treatment sessions when no calibration exists", () => {
    const treatment: Session[] = [
      session("t1", 0, 50, 6),
      session("t2", 30, 52, 6),
      session("t3", 60, 54, 6),
    ];

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: [],
      treatmentSessions: treatment,
      actives: [retinoid],
      cadenceDays: 30,
    });

    expect(verdict.reliability.sem).toBeGreaterThan(0);
    expect(verdict.mdc95).toBeGreaterThan(0);
  });

  it("orders sessions by day regardless of input order", () => {
    const scrambled: Session[] = [
      session("t3", 56, 62, 0.5),
      session("t1", 0, 50, 0.5),
      session("t2", 28, 56, 0.5),
    ];

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: QUIET_CALIBRATION,
      treatmentSessions: scrambled,
      actives: [retinoid],
      cadenceDays: 28,
    });

    expect(verdict.change).toBeCloseTo(12, 5);
    expect(verdict.studyDay).toBe(56);
  });

  it("requires at least two treatment sessions", () => {
    expect(() =>
      computeVerdict({
        concern: "texture",
        calibrationSessions: QUIET_CALIBRATION,
        treatmentSessions: [session("t1", 0, 50)],
        actives: [retinoid],
      }),
    ).toThrow(RangeError);
  });

  it("exposes the naive reading alongside the gated one", () => {
    const treatment: Session[] = [
      session("t1", 0, 50, 6),
      session("t2", 2, 54, 6),
      session("t3", 4, 52, 6),
    ];

    const verdict = computeVerdict({
      concern: "texture",
      calibrationSessions: NOISY_CALIBRATION,
      treatmentSessions: treatment,
      actives: [retinoid],
    });

    // Naive compares first frames only: (52-6) - (50-6) = 2
    expect(verdict.naiveChange).toBeCloseTo(2, 5);
    expect(verdict.change).toBeCloseTo(2, 5);
  });
});
