/**
 * Study data model.
 *
 * A study is stored as readings, not photographs. The face images are uploaded
 * to YouCam for scoring and never committed anywhere, what persists is the
 * numbers, which makes the whole dataset auditable by anyone reading the repo
 * without publishing anybody's face.
 *
 * `readings` maps a concern id to the per-frame scores from one session. Three
 * frames per session is the default: it is what makes the within-session spread
 * estimable at all, and it lowers the detection floor by √3.
 */

import type { ConcernId } from "../domain/concerns";

export interface StudyReadings {
  [concern: string]: number[];
}

export interface StudySession {
  id: string;
  /** Days from the study's day zero. Calibration sessions are negative or zero. */
  day: number;
  /** ISO timestamp of capture. */
  capturedAt: string;
  readings: StudyReadings;
  /** Free-text note, e.g. the lighting condition, for the record. */
  note?: string;
  /** Task ids returned by YouCam, kept so any reading can be traced back. */
  taskIds?: string[];
}

export interface StudyProduct {
  id: string;
  name: string;
  /** Ids from the actives catalogue. */
  activeIds: string[];
  /** Study day the product was introduced. */
  startedDay: number;
}

export interface Study {
  id: string;
  /** Subject label. Real studies use a pseudonym; this is not a place for names. */
  subject: string;
  startedAt: string;
  cadenceDays: number;
  products: StudyProduct[];
  /** Baseline sessions, captured before any product was introduced. */
  calibrationSessions: StudySession[];
  /** Sessions captured during treatment. */
  treatmentSessions: StudySession[];
  /** Concerns this study requests from the API. */
  concerns: ConcernId[];
  /**
   * Set false for illustrative data. The UI must label anything that is not a
   * real capture, because a demo that quietly shows invented results is exactly
   * the thing this project exists to argue against.
   */
  isRealCapture: boolean;
  notes?: string;
}
