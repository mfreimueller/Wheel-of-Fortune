import { describe, expect, it } from 'vitest';
import { buildExport, markExported, EXPORT_HEADER } from '../../src/core/exportCsv';
import type { AssessmentEntry, AssessmentsFile, CourseFile } from '../../src/core/schemas';

const student = (id: string, firstName: string, lastName: string) => ({
  id, graderId: null, firstName, lastName, color: null, pickCount: 0, weight: 1, active: true,
});
const course = (students = [student('s1', 'Anna', 'Bob'), student('s2', 'Maxi', 'Muster')]): CourseFile => ({
  schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3EHIF', subject: 'DBIx - Modellierung', archived: false,
  categories: ['Mitarbeit'], defaultCategory: 'Mitarbeit', students, specials: [],
});
const entry = (id: string, overrides: Partial<AssessmentEntry> = {}): AssessmentEntry => ({
  id, studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', gradedAt: '2026-10-07T09:00:00.000Z', exportedAt: null, ...overrides,
});
const file = (days: AssessmentsFile['days']): AssessmentsFile => ({ schemaVersion: 1, courseId: 'c1', days });

describe('buildExport', () => {
  it('writes the header and one Grader import row per graded entry', () => {
    const result = buildExport(course(), file([{ date: '2026-10-07', entries: [entry('e1')] }]), 'all');
    expect(result.csv).toBe(`${EXPORT_HEADER}\nBob;Anna;Mitarbeit;Aufruf (Mitarbeit);07.10.2026;;+\n`);
    expect(result.entryIds).toEqual(['e1']);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['PLUS', '+'],
    ['WELLE', '~'],
    ['MINUS', '-'],
  ] as const)('maps %s to the ASCII symbol %s', (symbol, expected) => {
    const { csv } = buildExport(course(), file([{ date: '2026-10-07', entries: [entry('e1', { symbol })] }]), 'all');
    expect(csv.trim().split('\n')[1]!.endsWith(`;;${expected}`)).toBe(true);
  });

  it('numbers a student\'s repeated picks of the same day and category', () => {
    const entries = [
      entry('e1', { gradedAt: '2026-10-07T09:00:00.000Z' }),
      entry('e2', { gradedAt: '2026-10-07T09:10:00.000Z', symbol: 'MINUS' }),
      entry('e3', { gradedAt: '2026-10-07T09:20:00.000Z', category: 'Wiederholung' }),
      entry('e4', { studentId: 's2', gradedAt: '2026-10-07T09:30:00.000Z' }),
    ];
    const lines = buildExport(course(), file([{ date: '2026-10-07', entries }]), 'all').csv.trim().split('\n').slice(1);
    expect(lines.map((l) => l.split(';')[3])).toEqual(['Aufruf (Mitarbeit)', 'Aufruf (Mitarbeit) 2', 'Aufruf (Wiederholung)', 'Aufruf (Mitarbeit)']);
  });

  it('keeps the numbering stable when earlier picks were already exported', () => {
    const entries = [
      entry('e1', { exportedAt: '2026-10-07T10:00:00.000Z' }),
      entry('e2', { gradedAt: '2026-10-07T09:10:00.000Z' }),
    ];
    const result = buildExport(course(), file([{ date: '2026-10-07', entries }]), 'new');
    expect(result.csv.trim().split('\n')).toHaveLength(2);
    expect(result.csv).toContain('Aufruf (Mitarbeit) 2');
    expect(result.entryIds).toEqual(['e2']);
  });

  it('exports everything with scope "all", including already exported entries', () => {
    const entries = [entry('e1', { exportedAt: '2026-10-07T10:00:00.000Z' }), entry('e2', { gradedAt: '2026-10-07T09:10:00.000Z' })];
    expect(buildExport(course(), file([{ date: '2026-10-07', entries }]), 'all').entryIds).toEqual(['e1', 'e2']);
  });

  it('orders rows by day and time', () => {
    const days = [
      { date: '2026-10-08', entries: [entry('late', { studentId: 's2' })] },
      { date: '2026-10-07', entries: [entry('early')] },
    ];
    expect(buildExport(course(), file(days), 'all').entryIds).toEqual(['early', 'late']);
  });

  it('produces only the header when there is nothing to export', () => {
    const result = buildExport(course(), file([]), 'new');
    expect(result.csv).toBe(`${EXPORT_HEADER}\n`);
    expect(result.entryIds).toEqual([]);
  });

  it('replaces characters Grader cannot parse and warns', () => {
    const odd = course([student('s1', 'Anna;Lena', 'Bob\nJr')]);
    const result = buildExport(odd, file([{ date: '2026-10-07', entries: [entry('e1', { category: 'Mit;arbeit' })] }]), 'all');
    expect(result.csv.trim().split('\n')).toHaveLength(2);
    expect(result.csv.split('\n')[1]!.split(';')).toHaveLength(7);
    expect(result.warnings).toContainEqual({ code: 'sanitized', detail: 'Anna;Lena Bob\nJr' });
  });

  it('skips entries of unknown students with a warning', () => {
    const result = buildExport(course(), file([{ date: '2026-10-07', entries: [entry('e1', { studentId: 'gone' })] }]), 'all');
    expect(result.entryIds).toEqual([]);
    expect(result.warnings).toEqual([{ code: 'unknown-student', detail: 'gone' }]);
  });
});

describe('markExported', () => {
  it('sets exportedAt on the given entries only and does not mutate the input', () => {
    const input = file([{ date: '2026-10-07', entries: [entry('e1'), entry('e2')] }]);
    const snapshot = structuredClone(input);
    const marked = markExported(input, ['e1'], new Date('2026-10-08T08:00:00Z'));
    expect(marked.days[0]!.entries.map((e) => e.exportedAt)).toEqual(['2026-10-08T08:00:00.000Z', null]);
    expect(input).toEqual(snapshot);
  });
});
