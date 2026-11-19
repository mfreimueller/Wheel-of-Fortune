import type { Result } from '../core/result';
import type { StudentPatch } from '../core/studentPatch';
import type { Special } from '../core/types';
import type { CourseFile } from '../core/schemas';
import type { CourseListing, EditOutcome, ImportOutcome, PickOutcome, ReadError, RestoreOutcome, BackupExportOutcome } from './types';

export type { CourseListing, EditOutcome, ImportOutcome, PickOutcome, ReadError, RestoreOutcome, BackupExportOutcome };

export type PickedFile = { ok: true; name: string; text: string } | { ok: false; error: 'too-large' } | null;

/** Everything the UI may ask the app to do. */
export interface WheelApi {
  courses: {
    list: () => Promise<CourseListing>;
    load: (id: string) => Promise<Result<CourseFile, ReadError>>;
    updateStudent: (input: { courseId: string; studentId: string; patch: StudentPatch }) => Promise<EditOutcome>;
    resetPickCounts: (courseId: string) => Promise<EditOutcome>;
    setArchived: (input: { courseId: string; archived: boolean }) => Promise<EditOutcome>;
    /** Removes the course for good. */
    delete: (courseId: string) => Promise<EditOutcome>;
    /** Replaces all special segments of the course. */
    setSpecials: (input: { courseId: string; specials: Special[] }) => Promise<EditOutcome>;
  };
  roster: {
    /** `null` when the file dialog was cancelled. */
    pick: () => Promise<PickedFile>;
    import: (input: { text: string; schoolYear?: string }) => Promise<ImportOutcome>;
  };
  pick: {
    /** Random draw; the pick is counted before the call returns. */
    draw: (input: { courseId: string; fair: boolean; absentIds: string[] }) => Promise<PickOutcome>;
    /** Direct pick without a spin. */
    student: (input: { courseId: string; studentId: string }) => Promise<PickOutcome>;
  };
  backup: {
    /** Downloads the whole database as a JSON file; fails when the stored data is unreadable. */
    export: () => Promise<BackupExportOutcome>;
    /** Asks for a backup file and replaces the whole database. `null` when cancelled. */
    import: () => Promise<RestoreOutcome | null>;
    /** ISO timestamp of the last exported backup, `null` if there was none yet. */
    lastBackupAt: () => string | null;
    /** Recovery for unreadable stored data: downloads the raw text as it is stored. */
    downloadRaw: () => Promise<void>;
    /** Recovery for unreadable stored data: deletes everything. */
    reset: () => Promise<void>;
  };
}
