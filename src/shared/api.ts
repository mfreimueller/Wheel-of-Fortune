import type { GradeSymbol } from '../core/assessments';
import type { Result } from '../core/result';
import type { CourseFile } from '../core/schemas';
import type { CourseListing, GradeOutcome, ImportOutcome, PickOutcome, ReadError } from './types';

export type { CourseListing, GradeOutcome, GradeSymbol, ImportOutcome, PickOutcome, ReadError };

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
  pick: {
    /** Random draw; the pick is counted before the call returns. */
    draw: (input: { courseId: string; fair: boolean; absentIds: string[] }) => Promise<PickOutcome>;
    /** Direct pick without a spin. */
    student: (input: { courseId: string; studentId: string }) => Promise<PickOutcome>;
  };
  grade: {
    /** Creates, replaces (`replaces`) or, with `symbol: null`, removes today's graded pick. */
    set: (input: { courseId: string; studentId: string; category: string; symbol: GradeSymbol | null; replaces?: string | null }) => Promise<GradeOutcome>;
  };
}

export const CHANNELS = {
  coursesList: 'courses:list',
  courseLoad: 'courses:load',
  rosterPick: 'roster:pick',
  rosterImport: 'roster:import',
  pickDraw: 'pick:draw',
  pickStudent: 'pick:student',
  gradeSet: 'grade:set',
} as const;
