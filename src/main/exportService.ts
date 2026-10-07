import { buildExport, markExported, type ExportScope, type ExportWarning } from '../core/exportCsv';
import type { CourseStore } from './store/courseStore';

export type SummaryOutcome = { ok: true; newCount: number; totalCount: number } | { ok: false; error: 'course-unreadable' };

export type ExportOutcome =
  | { ok: true; /** `null` when the save dialog was cancelled. */ filePath: string | null; count: number; warnings: ExportWarning[] }
  | { ok: false; error: 'course-unreadable' | 'nothing-to-export' };

/** Saves the CSV and returns where it went, or `null` if the user cancelled. */
export type SaveFile = (suggestedName: string, csv: string) => Promise<string | null>;

export class ExportService {
  constructor(
    private readonly store: CourseStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summary(courseId: string): Promise<SummaryOutcome> {
    const loaded = await this.load(courseId);
    if (!loaded) return { ok: false, error: 'course-unreadable' };
    const entries = loaded.assessments.days.flatMap((d) => d.entries);
    return { ok: true, newCount: entries.filter((e) => !e.exportedAt).length, totalCount: entries.length };
  }

  async run(courseId: string, scope: ExportScope, save: SaveFile): Promise<ExportOutcome> {
    const loaded = await this.load(courseId);
    if (!loaded) return { ok: false, error: 'course-unreadable' };

    const result = buildExport(loaded.course, loaded.assessments, scope);
    if (result.entryIds.length === 0) return { ok: false, error: 'nothing-to-export' };

    const filePath = await save(fileName(loaded.course.className, loaded.course.subject), result.csv);
    if (!filePath) return { ok: true, filePath: null, count: 0, warnings: [] };

    // Marked only now: a cancelled or failed save must not hide entries from the next export.
    await this.store.saveAssessments(markExported(loaded.assessments, result.entryIds, this.now()));
    return { ok: true, filePath, count: result.entryIds.length, warnings: result.warnings };
  }

  private async load(courseId: string) {
    const course = await this.store.loadCourse(courseId);
    const assessments = await this.store.loadAssessments(courseId);
    return course.ok && assessments.ok ? { course: course.value, assessments: assessments.value } : null;
  }
}

function fileName(className: string, subject: string): string {
  return `${className}_${subject}_Aufrufe.csv`.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
}
