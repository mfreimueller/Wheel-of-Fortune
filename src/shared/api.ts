import type { GradeSymbol } from '../core/assessments';
import type { Result } from '../core/result';
import type { StudentPatch } from '../core/studentPatch';
import type { CourseFile } from '../core/schemas';
import type { CourseListing, EditOutcome, ExportOutcome, GradeOutcome, ImportOutcome, PickOutcome, ReadError, SummaryOutcome } from './types';

export type { CourseListing, EditOutcome, ExportOutcome, GradeOutcome, GradeSymbol, ImportOutcome, PickOutcome, ReadError, SummaryOutcome };

export type PickedFile = { ok: true; name: string; text: string } | { ok: false; error: 'too-large' } | null;

/** Everything the renderer may ask the main process to do. */
export interface WheelApi {
  courses: {
    list: () => Promise<CourseListing>;
    load: (id: string) => Promise<Result<CourseFile, ReadError>>;
    updateStudent: (input: { courseId: string; studentId: string; patch: StudentPatch }) => Promise<EditOutcome>;
    resetPickCounts: (courseId: string) => Promise<EditOutcome>;
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
  export: {
    summary: (courseId: string) => Promise<SummaryOutcome>;
    /** Opens the save dialog; "new" = entries not exported before. */
    run: (input: { courseId: string; scope: 'new' | 'all' }) => Promise<ExportOutcome>;
  };
  grade: {
    /** Creates, replaces (`replaces`) or, with `symbol: null`, removes today's graded pick. */
    set: (input: { courseId: string; studentId: string; category: string; symbol: GradeSymbol | null; replaces?: string | null }) => Promise<GradeOutcome>;
  };
}

export const CHANNELS = {
  coursesList: 'courses:list',
  courseLoad: 'courses:load',
  studentUpdate: 'courses:updateStudent',
  countsReset: 'courses:resetPickCounts',
  rosterPick: 'roster:pick',
  rosterImport: 'roster:import',
  pickDraw: 'pick:draw',
  pickStudent: 'pick:student',
  gradeSet: 'grade:set',
  exportSummary: 'export:summary',
  exportRun: 'export:run',
} as const;
