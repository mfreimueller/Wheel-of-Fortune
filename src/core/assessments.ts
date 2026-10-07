import type { AssessmentEntry, AssessmentsFile } from './schemas';

export type GradeSymbol = AssessmentEntry['symbol'];

export interface GradeChange {
  /** ISO day of the entry, e.g. "2026-10-07". */
  date: string;
  studentId: string;
  category: string;
  /** `null` only removes `replaces`. */
  symbol: GradeSymbol | null;
  /** The entry this one supersedes (the dialog's previous entry). */
  replaces?: string | null;
  now: Date;
  newId: (prefix: string) => string;
}

/** The local calendar day as YYYY-MM-DD (teachers think in local days, not UTC). */
export function localDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Returns a new file with the entry replaced, added or removed; the input is left untouched. */
export function applyGrade(file: AssessmentsFile, change: GradeChange): { file: AssessmentsFile; entryId: string | null } {
  let days = file.days.map((day) => ({
    ...day,
    entries: day.entries.filter((entry) => entry.id !== change.replaces),
  }));

  let entryId: string | null = null;
  if (change.symbol) {
    entryId = change.newId('e');
    const entry: AssessmentEntry = {
      id: entryId,
      studentId: change.studentId,
      category: change.category,
      symbol: change.symbol,
      gradedAt: change.now.toISOString(),
      exportedAt: null,
    };
    const day = days.find((d) => d.date === change.date);
    if (day) day.entries.push(entry);
    else days.push({ date: change.date, entries: [entry] });
  }

  days = days.filter((day) => day.entries.length > 0).sort((a, b) => a.date.localeCompare(b.date));
  return { file: { ...file, days }, entryId };
}
