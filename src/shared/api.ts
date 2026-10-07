import type { Result } from '../core/result';
import type { CourseFile } from '../core/schemas';
import type { CourseListing, ImportOutcome, ReadError } from './types';

export type { CourseListing, ImportOutcome, ReadError };

export type PickedFile = { ok: true; name: string; text: string } | { ok: false; error: 'too-large' } | null;

/** Everything the renderer may ask the main process to do. */
export interface WheelApi {
  courses: {
    list: () => Promise<CourseListing>;
    load: (id: string) => Promise<Result<CourseFile, ReadError>>;
  };
  roster: {
    /** `null` when the file dialog was cancelled. */
    pick: () => Promise<PickedFile>;
    import: (input: { text: string; schoolYear?: string }) => Promise<ImportOutcome>;
  };
}

export const CHANNELS = {
  coursesList: 'courses:list',
  courseLoad: 'courses:load',
  rosterPick: 'roster:pick',
  rosterImport: 'roster:import',
} as const;
