/**
 * Study loading and verdict assembly.
 *
 * Studies are plain JSON committed alongside the code. That is a deliberate
 * choice: the readings behind every claim this app makes are readable by anyone
 * who opens the repository, which is what "auditable" has to mean if the word is
 * going to be used at all.
 */

import { computeVerdict, type Verdict } from "../stats/verdict";
import { estimateReliability, mean, type Session } from "../stats/reliability";
import { getActive, type Active } from "../domain/actives";
import { CONCERNS, type ConcernId } from "../domain/concerns";
import type { Study, StudySession } from "./types";

import studyJson from "@/data/study.json";

export const study = studyJson as unknown as Study;

/** Convert stored readings for one concern into the stats layer's Session shape. */
export function toSessions(
  sessions: readonly StudySession[],
  concern: ConcernId,
): Session[] {
  return sessions
    .filter((s) => Array.isArray(s.readings[concern]) && s.readings[concern].length > 0)
    .map((s) => ({ id: s.id, day: s.day, frames: s.readings[concern] }));
}

export function activesFor(source: Study): Active[] {
  const actives: Active[] = [];
  for (const product of source.products) {
    for (const id of product.activeIds) {
      const active = getActive(id);
      if (active && !actives.includes(active)) actives.push(active);
    }
  }
  return actives;
}

export interface ConcernVerdict {
  concern: ConcernId;
  verdict: Verdict | null;
  /** Why no verdict could be computed, when `verdict` is null. */
  unavailableReason?: string;
}

/** Verdicts for every concern the study tracks. */
export function verdictsFor(source: Study = study): ConcernVerdict[] {
  const actives = activesFor(source);

  return source.concerns.map((concern) => {
    const treatmentSessions = toSessions(source.treatmentSessions, concern);
    const calibrationSessions = toSessions(source.calibrationSessions, concern);

    if (treatmentSessions.length < 2) {
      return {
        concern,
        verdict: null,
        unavailableReason:
          treatmentSessions.length === 0
            ? "No sessions captured yet."
            : "One session captured. A change needs two.",
      };
    }

    try {
      return {
        concern,
        verdict: computeVerdict({
          concern,
          calibrationSessions,
          treatmentSessions,
          actives,
          cadenceDays: source.cadenceDays,
        }),
      };
    } catch (error) {
      return {
        concern,
        verdict: null,
        unavailableReason:
          error instanceof Error ? error.message : "Verdict could not be computed.",
      };
    }
  });
}

export interface ConcernFloor {
  concern: ConcernId;
  /** Session means across the calibration sessions, in capture order. */
  sessionMeans: number[];
  /** Total drift across the calibration window, last mean minus first. */
  drift: number;
  /** The bar a change must clear, MDC95 on session means. */
  floor: number;
  /**
   * The frame-level tolerance: what the instrument repeats to inside a single
   * sitting, with the camera untouched.
   *
   * Kept separate from `floor` because it is the only non-circular thing to plot
   * drift against. `floor` is derived from the session means themselves whenever
   * between-session error dominates, so plotting those means against it would
   * compare a set of numbers to a band computed from them, and the marks could
   * essentially never fall outside. This one is computed from within-session
   * spread only, so a mark escaping it genuinely means the reading wandered
   * further between sittings than the instrument wanders inside one.
   */
  withinFloor: number;
  basis: "within-session" | "between-session";
  /**
   * Whether this concern can support a verdict at all under these capture
   * conditions. A floor wider than this is not a precise instrument reporting a
   * small effect, it is an instrument that cannot see the effect at all.
   */
  usable: "measurable" | "marginal" | "unusable";
}

const MEASURABLE_FLOOR = 3.5;
const MARGINAL_FLOOR = 8;

/**
 * The measured noise floor for every concern, from the calibration sessions.
 *
 * This exists to be shown before any treatment data does. Knowing which metrics
 * are capable of answering the question is worth more than a confident answer
 * from one that is not, and it is the only honest thing to put on screen while a
 * study is still accumulating.
 */
export function calibrationFloors(source: Study = study): ConcernFloor[] {
  return source.concerns
    .map((concern) => {
      const sessions = toSessions(source.calibrationSessions, concern);
      if (sessions.length === 0) return null;

      const estimate = estimateReliability(sessions);
      const sessionMeans = sessions.map((s) => mean(s.frames));
      const floor = estimate.mdc95SessionMean;

      // mdc95Single is the frame-to-frame tolerance; dividing by √k gives the
      // equivalent for a session mean of k frames.
      const withinFloor =
        estimate.mdc95Single / Math.sqrt(Math.max(1, estimate.framesPerSession));

      return {
        concern,
        sessionMeans,
        withinFloor,
        drift:
          sessionMeans.length >= 2
            ? sessionMeans[sessionMeans.length - 1] - sessionMeans[0]
            : 0,
        floor,
        basis: estimate.basis,
        usable:
          floor <= MEASURABLE_FLOOR
            ? ("measurable" as const)
            : floor <= MARGINAL_FLOOR
              ? ("marginal" as const)
              : ("unusable" as const),
      };
    })
    .filter((f): f is ConcernFloor => f !== null)
    .sort((a, b) => a.floor - b.floor);
}

export interface ConcernProgress {
  concern: ConcernId;
  /** Baseline mean across all calibration sessions. */
  baseline: number;
  /** Latest treatment session mean, or null before treatment begins. */
  latest: number | null;
  /** Signed so positive always means better. */
  change: number | null;
  floor: number;
  /** True once the change exceeds the floor. */
  clears: boolean;
  usable: ConcernFloor["usable"];
}

/**
 * Where each concern currently stands, before a verdict is possible.
 *
 * A verdict needs two treatment sessions and a concern past its biological
 * floor. Until then the honest thing to show is not an empty page but the study
 * actually running: what the baseline was, where the latest reading sits, and
 * how far it is from the bar it has to clear.
 */
export function concernProgress(source: Study = study): ConcernProgress[] {
  const floors = calibrationFloors(source);

  return floors.map((row) => {
    const meta = CONCERNS[row.concern];
    const baselineFrames = toSessions(source.calibrationSessions, row.concern).flatMap(
      (s) => s.frames,
    );
    const treatment = toSessions(source.treatmentSessions, row.concern);
    const baseline = baselineFrames.length > 0 ? mean(baselineFrames) : 0;
    const latest =
      treatment.length > 0 ? mean(treatment[treatment.length - 1].frames) : null;

    // Positive always means better, whichever way the underlying score moves.
    const direction = meta.higherIsBetter ? 1 : -1;
    const change = latest === null ? null : (latest - baseline) * direction;

    return {
      concern: row.concern,
      baseline,
      latest,
      change,
      floor: row.floor,
      clears: change !== null && Math.abs(change) > row.floor,
      usable: row.usable,
    };
  });
}

export interface StudyProgress {
  sessionCount: number;
  calibrationSessionCount: number;
  frameCount: number;
  studyDays: number;
  hasData: boolean;
}

export function studyProgress(source: Study = study): StudyProgress {
  const days = source.treatmentSessions.map((s) => s.day);
  const frameCount = [...source.calibrationSessions, ...source.treatmentSessions].reduce(
    (sum, session) =>
      sum +
      Object.values(session.readings).reduce(
        (n, frames) => Math.max(n, frames.length),
        0,
      ),
    0,
  );

  return {
    sessionCount: source.treatmentSessions.length,
    calibrationSessionCount: source.calibrationSessions.length,
    frameCount,
    studyDays: days.length > 0 ? Math.max(...days) - Math.min(...days) : 0,
    hasData: source.treatmentSessions.length >= 2,
  };
}

/** Ordering for display: decided verdicts first, then the ones still measuring. */
const STATE_ORDER = [
  "worsening",
  "working",
  "expected_purge",
  "not_working",
  "insufficient_evidence",
  // Last: a concern that cannot measure anything on this face is the least
  // useful row on the page, even though it is an honest one.
  "saturated",
] as const;

export function sortVerdicts(verdicts: ConcernVerdict[]): ConcernVerdict[] {
  return [...verdicts].sort((a, b) => {
    if (!a.verdict && !b.verdict) return 0;
    if (!a.verdict) return 1;
    if (!b.verdict) return -1;
    return STATE_ORDER.indexOf(a.verdict.state) - STATE_ORDER.indexOf(b.verdict.state);
  });
}
