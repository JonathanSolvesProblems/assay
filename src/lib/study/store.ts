/**
 * Study loading and verdict assembly.
 *
 * Studies are plain JSON committed alongside the code. That is a deliberate
 * choice: the readings behind every claim this app makes are readable by anyone
 * who opens the repository, which is what "auditable" has to mean if the word is
 * going to be used at all.
 */

import { computeVerdict, type Verdict } from "../stats/verdict";
import type { Session } from "../stats/reliability";
import { getActive, type Active } from "../domain/actives";
import type { ConcernId } from "../domain/concerns";
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
