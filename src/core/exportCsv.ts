import type { AssessmentEntry, AssessmentsFile, CourseFile } from './schemas';

/** The columns of Grader's grade import: it reads `;`-separated rows and does not understand quoting. */
export const EXPORT_HEADER = 'Nachname;Vorname;Kategorie;Name;Datum;Max;Note';

export type ExportScope = 'new' | 'all';

export interface ExportWarning {
  code: 'sanitized' | 'unknown-student';
  detail: string;
}

export interface ExportResult {
  csv: string;
  /** The entries that are part of `csv`, i.e. those to mark as exported. */
  entryIds: string[];
  warnings: ExportWarning[];
}

const SYMBOLS: Record<AssessmentEntry['symbol'], string> = { PLUS: '+', WELLE: '~', MINUS: '-' };

const unsafe = /[;\r\n]+/g;
const clean = (value: string): string => value.replace(unsafe, ' ').trim();

function germanDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Graded picks as Grader's import expects them. Grader reuses an assessment by (date, title) and ignores the
 * category, so the title carries the category, and a student's repeated picks of the day are numbered. The
 * number counts all of the day's entries, so it stays the same whatever was exported before.
 */
export function buildExport(course: CourseFile, assessments: AssessmentsFile, scope: ExportScope): ExportResult {
  const students = new Map(course.students.map((s) => [s.id, s]));
  const lines: string[] = [EXPORT_HEADER];
  const entryIds: string[] = [];
  const warnings: ExportWarning[] = [];

  for (const day of [...assessments.days].sort((a, b) => a.date.localeCompare(b.date))) {
    const seen = new Map<string, number>();
    for (const entry of [...day.entries].sort((a, b) => a.gradedAt.localeCompare(b.gradedAt))) {
      const student = students.get(entry.studentId);
      if (!student) {
        warnings.push({ code: 'unknown-student', detail: entry.studentId });
        continue;
      }
      const key = `${entry.studentId}\u0000${entry.category}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (scope === 'new' && entry.exportedAt) continue;

      const fields = [student.lastName, student.firstName, entry.category];
      const cleaned = fields.map(clean);
      if (cleaned.some((value, i) => value !== fields[i])) {
        const detail = `${student.firstName} ${student.lastName}`;
        if (!warnings.some((w) => w.code === 'sanitized' && w.detail === detail)) warnings.push({ code: 'sanitized', detail });
      }
      const [lastName, firstName, category] = cleaned;
      const title = `Aufruf (${category})${n > 1 ? ` ${n}` : ''}`;
      lines.push([lastName, firstName, category, title, germanDate(day.date), '', SYMBOLS[entry.symbol]].join(';'));
      entryIds.push(entry.id);
    }
  }
  return { csv: `${lines.join('\n')}\n`, entryIds, warnings };
}

export function markExported(file: AssessmentsFile, entryIds: readonly string[], now: Date): AssessmentsFile {
  const ids = new Set(entryIds);
  return {
    ...file,
    days: file.days.map((day) => ({
      ...day,
      entries: day.entries.map((e) => (ids.has(e.id) ? { ...e, exportedAt: now.toISOString() } : e)),
    })),
  };
}
