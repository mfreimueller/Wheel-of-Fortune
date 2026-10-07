import type { GradeSymbol } from '../core/assessments';
import type { Result } from '../core/result';
import type { StudentPatch } from '../core/studentPatch';
import type { Special } from '../core/types';
import type { CourseFile } from '../core/schemas';
import type { CourseListing, DataDirInfo, EditOutcome, ExportOutcome, GradeOutcome, ImportOutcome, PickOutcome, ReadError, SummaryOutcome } from './types';

export type { CourseListing, DataDirInfo, EditOutcome, ExportOutcome, GradeOutcome, GradeSymbol, ImportOutcome, PickOutcome, ReadError, SummaryOutcome };

export type PickedFile = { ok: true; name: string; text: string } | { ok: false; error: 'too-large' } | null;

/** Everything the renderer may ask the main process to do. */
export interface WheelApi {
  courses: {
    list: () => Promise<CourseListing>;
    load: (id: string) => Promise<Result<CourseFile, ReadError>>;
    updateStudent: (input: { courseId: string; studentId: string; patch: StudentPatch }) => Promise<EditOutcome>;
    resetPickCounts: (courseId: string) => Promise<EditOutcome>;
    setArchived: (input: { courseId: string; archived: boolean }) => Promise<EditOutcome>;
    /** Moves the course files to `.trash`. */
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
  settings: {
    get: () => Promise<DataDirInfo>;
    /** Opens a folder dialog; on success the app restarts with the new folder. `null` when cancelled. */
    chooseDataDir: () => Promise<{ ok: true } | { ok: false; error: 'locked' } | null>;
    revealDataDir: () => Promise<void>;
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
  specialsSet: 'courses:setSpecials',
  courseArchive: 'courses:setArchived',
  courseDelete: 'courses:delete',
  settingsGet: 'settings:get',
  settingsChoose: 'settings:chooseDataDir',
  settingsReveal: 'settings:revealDataDir',
  rosterPick: 'roster:pick',
  rosterImport: 'roster:import',
  pickDraw: 'pick:draw',
  pickStudent: 'pick:student',
  gradeSet: 'grade:set',
  exportSummary: 'export:summary',
  exportRun: 'export:run',
} as const;
