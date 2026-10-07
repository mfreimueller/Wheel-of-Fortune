import { nameKey } from './names';
import type { ParsedRoster, ParsedStudent, RosterWarning } from './rosterCsv';
import { CURRENT_SCHEMA_VERSION, type CourseFile } from './schemas';
import type { Student } from './types';

export interface MergeReport {
  courseCreated: boolean;
  added: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  warnings: RosterWarning[];
}

export interface MergeResult {
  course: CourseFile;
  report: MergeReport;
}

/**
 * Applies a parsed Grader roster to a course (or creates it). Counts, weights, specials and grades are
 * never touched; known students only get a new color (and a rename when matched by Id).
 */
export function mergeRoster(
  existing: CourseFile | null,
  parsed: ParsedRoster & { schoolYear: string },
  newId: (prefix: string) => string,
): MergeResult {
  const students: Student[] = (existing?.students ?? []).map((s) => ({ ...s }));
  const report: MergeReport = { courseCreated: existing === null, added: 0, updated: 0, reactivated: 0, deactivated: 0, warnings: [...parsed.warnings] };
  const seen = new Set<string>();
  const decidedGroups = new Set<string>();

  const add = (row: ParsedStudent): void => {
    const id = newId('s');
    seen.add(id);
    students.push({ id, graderId: row.graderId, firstName: row.firstName, lastName: row.lastName, color: row.color, pickCount: 0, weight: 1, active: true });
    report.added += 1;
  };

  const sync = (student: Student, row: ParsedStudent, byId: boolean): void => {
    seen.add(student.id);
    let changed = false;
    if (byId && (student.firstName !== row.firstName || student.lastName !== row.lastName)) {
      student.firstName = row.firstName;
      student.lastName = row.lastName;
      changed = true;
    }
    if (row.graderId && student.graderId !== row.graderId) {
      student.graderId = row.graderId;
      changed = true;
    }
    if (row.color && student.color !== row.color) {
      student.color = row.color;
      changed = true;
    }
    if (changed) report.updated += 1;
    if (!student.active) {
      student.active = true;
      report.reactivated += 1;
    }
  };

  const idMatch = (row: ParsedStudent): Student | undefined =>
    row.graderId ? students.find((s) => s.graderId === row.graderId) : undefined;

  const byName = new Map<string, ParsedStudent[]>();
  for (const row of parsed.students) {
    if (idMatch(row)) continue;
    const key = nameKey(row.firstName, row.lastName);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  for (const row of parsed.students) {
    const byIdStudent = idMatch(row);
    if (byIdStudent) {
      sync(byIdStudent, row, true);
      continue;
    }

    const key = nameKey(row.firstName, row.lastName);
    if (decidedGroups.has(key)) continue;
    decidedGroups.add(key);

    const rows = byName.get(key) ?? [row];
    // A different, known Id means a different person even if the name is the same.
    const candidates = students.filter(
      (s) => !seen.has(s.id) && nameKey(s.firstName, s.lastName) === key && (row.graderId === null || s.graderId === null),
    );

    if (rows.length === 1 && candidates.length === 1) {
      sync(candidates[0]!, row, false);
      continue;
    }
    if (rows.length > 1 || candidates.length > 1) {
      report.warnings.push({ code: 'duplicate-name', detail: `${row.firstName} ${row.lastName}` });
    }
    // Ambiguous: never guess which is which. Known students stay untouched, only surplus rows are new.
    for (const candidate of candidates.slice(0, rows.length)) seen.add(candidate.id);
    for (const surplus of rows.slice(candidates.length)) add(surplus);
  }

  for (const student of students) {
    if (!seen.has(student.id) && student.active) {
      student.active = false;
      report.deactivated += 1;
    }
  }

  const course: CourseFile = existing
    ? { ...existing, categories: parsed.categories ?? existing.categories, students }
    : {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: newId('c'),
        schoolYear: parsed.schoolYear,
        className: parsed.className,
        subject: parsed.subject,
        archived: false,
        categories: parsed.categories ?? [],
        defaultCategory: 'Mitarbeit',
        students,
        specials: [],
      };
  return { course, report };
}
