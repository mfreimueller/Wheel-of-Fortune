import Papa from 'papaparse';
import { normalizeColor } from './color';
import { fail, ok, type Result } from './result';
import { normalizeSchoolYear } from './schoolYear';

export interface ParsedStudent {
  graderId: string | null;
  firstName: string;
  lastName: string;
  color: string | null;
}

export interface RosterWarning {
  code: 'invalid-color' | 'missing-name' | 'duplicate-name';
  /** 1-based CSV line, the header being line 1. */
  row?: number;
  detail?: string;
}

export interface ParsedRoster {
  className: string;
  subject: string;
  /** `null` when the CSV has no `Schuljahr` column; the import dialog then asks. */
  schoolYear: string | null;
  /** `null` when the CSV has no `Kategorien` column. */
  categories: string[] | null;
  students: ParsedStudent[];
  warnings: RosterWarning[];
}

export interface RosterError {
  code: 'missing-column' | 'mixed-course' | 'invalid-school-year' | 'no-students';
  detail?: string;
}

const REQUIRED = ['Klasse', 'Fach', 'Vorname', 'Nachname'] as const;

/** Reads the roster CSV exported by Grader: header-based, `,` or `;`, quoted fields, BOM tolerated. */
export function parseRosterCsv(text: string): Result<ParsedRoster, RosterError> {
  const { data, meta } = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const columns = new Set(meta.fields ?? []);
  for (const column of REQUIRED) {
    if (!columns.has(column)) return fail({ code: 'missing-column', detail: column });
  }
  const hasSchoolYear = columns.has('Schuljahr');
  const cell = (row: Record<string, string | undefined>, column: string): string => (row[column] ?? '').trim();

  const warnings: RosterWarning[] = [];
  const students: ParsedStudent[] = [];
  const courses = new Set<string>();
  let className = '';
  let subject = '';
  let rawYear = '';
  let categories: string[] | null = null;

  for (const [index, row] of data.entries()) {
    const line = index + 2;
    courses.add([cell(row, 'Klasse'), cell(row, 'Fach'), hasSchoolYear ? cell(row, 'Schuljahr') : ''].join('\u0000'));
    if (courses.size === 1) {
      className = cell(row, 'Klasse');
      subject = cell(row, 'Fach');
      rawYear = hasSchoolYear ? cell(row, 'Schuljahr') : '';
    }
    if (categories === null && columns.has('Kategorien') && cell(row, 'Kategorien')) {
      categories = [...new Set(cell(row, 'Kategorien').split('|').map((c) => c.trim()).filter(Boolean))];
    }

    const firstName = cell(row, 'Vorname');
    const lastName = cell(row, 'Nachname');
    if (!firstName && !lastName) continue;
    if (!firstName || !lastName) {
      warnings.push({ code: 'missing-name', row: line });
      continue;
    }

    const rawColor = cell(row, 'Color');
    let color: string | null = null;
    if (rawColor) {
      color = normalizeColor(rawColor);
      if (!color) warnings.push({ code: 'invalid-color', row: line, detail: rawColor });
    }
    students.push({ graderId: cell(row, 'Id') || null, firstName, lastName, color });
  }

  if (courses.size > 1) return fail({ code: 'mixed-course' });
  if (students.length === 0) return fail({ code: 'no-students' });

  let schoolYear: string | null = null;
  if (hasSchoolYear) {
    schoolYear = normalizeSchoolYear(rawYear);
    if (!schoolYear) return fail({ code: 'invalid-school-year', detail: rawYear });
  }
  return ok({ className, subject, schoolYear, categories: columns.has('Kategorien') ? (categories ?? []) : null, students, warnings });
}
