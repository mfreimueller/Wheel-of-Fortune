import { describe, expect, it } from 'vitest';
import { buildExport } from '../../src/core/exportCsv';
import type { AssessmentsFile, CourseFile } from '../../src/core/schemas';

/**
 * A faithful copy of the parsing rules in Grader's `GradeImportService` (parseCsv, parseDate, SYMBOL_MAP).
 * If Grader's import changes, this replica and docs/formats.md must change with it.
 */
function graderParse(content: string, hasHeader = true) {
  const cleaned = content.replace(/^﻿/, '').replace(/\r/g, '');
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const parts = line.trim().split(';');
    if (parts.length < 7) throw new Error('Ungültiges Format, erwarte 7 semikolon-getrennte Spalten');
    const [lastname, firstname, type, name, date, max, note] = parts.map((p) => p.trim());
    const [dd, mm, yy] = date!.split('.');
    if (!dd || !mm || !yy) throw new Error(`Ungültiges Datum: "${date}"`);
    return { lastname, firstname, type, name, date, max, note };
  });
}

const course: CourseFile = {
  schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3EHIF', subject: 'Info', archived: false,
  categories: ['Mitarbeit'], defaultCategory: 'Mitarbeit',
  students: [
    { id: 's1', graderId: null, firstName: 'Jörg', lastName: 'Müller-Lüdenscheidt, Jr.', color: null, pickCount: 0, weight: 1, active: true },
    { id: 's2', graderId: null, firstName: 'Anna;Lena', lastName: 'Bob', color: null, pickCount: 0, weight: 1, active: true },
  ],
  specials: [],
};
const assessments: AssessmentsFile = {
  schemaVersion: 1,
  courseId: 'c1',
  days: [
    {
      date: '2026-10-07',
      entries: [
        { id: 'e1', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', gradedAt: '2026-10-07T09:00:00.000Z', exportedAt: null },
        { id: 'e2', studentId: 's1', category: 'Mitarbeit', symbol: 'WELLE', gradedAt: '2026-10-07T09:05:00.000Z', exportedAt: null },
        { id: 'e3', studentId: 's2', category: 'Mitarbeit', symbol: 'MINUS', gradedAt: '2026-10-07T09:10:00.000Z', exportedAt: null },
      ],
    },
  ],
};

describe('Grader import contract', () => {
  const rows = graderParse(buildExport(course, assessments, 'all').csv);

  it('every exported row is parsed by Grader into seven columns', () => {
    expect(rows).toHaveLength(3);
  });

  it('uses Grader\'s date format and tertiary symbols, and leaves Max empty', () => {
    expect(rows.map((r) => [r.date, r.max, r.note])).toEqual([
      ['07.10.2026', '', '+'],
      ['07.10.2026', '', '~'],
      ['07.10.2026', '', '-'],
    ]);
  });

  it('keeps commas and umlauts in names intact (Grader splits on semicolons only)', () => {
    expect(rows[0]).toMatchObject({ lastname: 'Müller-Lüdenscheidt, Jr.', firstname: 'Jörg' });
  });

  it('gives a second pick of the same student, day and category a different assessment title', () => {
    expect(rows.map((r) => r.name)).toEqual(['Aufruf (Mitarbeit)', 'Aufruf (Mitarbeit) 2', 'Aufruf (Mitarbeit)']);
  });
});
