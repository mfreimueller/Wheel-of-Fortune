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
