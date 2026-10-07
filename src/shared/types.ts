import type { DrawResult } from '../core/draw';
import type { RosterError } from '../core/rosterCsv';
import type { MergeReport } from '../core/rosterMerge';

export interface ReadError {
  kind: 'missing' | 'invalid' | 'newer-schema' | 'unreadable';
  file: string;
  message: string;
  /** Only for `invalid`: a valid `.bak` exists and could be restored. */
  backupAvailable: boolean;
}

export interface CourseSummary {
  id: string;
  schoolYear: string;
  className: string;
  subject: string;
  archived: boolean;
}

export interface CourseListing {
  courses: CourseSummary[];
  /** Files that exist but could not be read; shown to the user instead of silently ignored. */
  problems: ReadError[];
}

export type ImportOutcome =
  | { status: 'needs-school-year'; suggested: string }
  | { status: 'imported'; courseId: string; report: MergeReport }
  | { status: 'error'; error: RosterError | { code: 'unreadable-course'; detail: string } };

export interface PickedStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  color: string | null;
  /** The count after this pick. */
  pickCount: number;
}

export type PickOutcome =
  | {
      ok: true;
      /** Every spin to play back; all but the last are spin-again specials. */
      spins: DrawResult[];
      /** The student that was picked (and counted); `null` when the final result is a message special. */
      picked: PickedStudent | null;
    }
  | { ok: false; error: 'no-eligible-students' | 'unknown-student' | 'course-unreadable' };
