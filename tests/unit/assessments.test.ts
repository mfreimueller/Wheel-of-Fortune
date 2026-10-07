import { describe, expect, it } from 'vitest';
import { applyGrade, localDate } from '../../src/core/assessments';
import type { AssessmentsFile } from '../../src/core/schemas';

const empty: AssessmentsFile = { schemaVersion: 1, courseId: 'c1', days: [] };
const when = new Date('2026-10-07T09:14:03Z');
let counter = 0;
const newId = () => `e_${++counter}`;

const grade = (file: AssessmentsFile, change: Partial<Parameters<typeof applyGrade>[1]> = {}) =>
  applyGrade(file, { date: '2026-10-07', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', now: when, newId, ...change });

describe('localDate', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
    expect(localDate(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});

describe('applyGrade', () => {
  it('creates the day and the entry', () => {
    const { file, entryId } = grade(empty);
    expect(entryId).toBe('e_1');
    expect(file.days).toEqual([
      { date: '2026-10-07', entries: [{ id: 'e_1', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', gradedAt: '2026-10-07T09:14:03.000Z', exportedAt: null }] },
    ]);
  });

  it('appends to an existing day and keeps other days', () => {
    const first = grade(empty, { date: '2026-10-06' }).file;
    const second = grade(first, { studentId: 's2' }).file;
    const third = grade(second, { studentId: 's3' }).file;
    expect(third.days.map((d) => [d.date, d.entries.length])).toEqual([['2026-10-06', 1], ['2026-10-07', 2]]);
  });

  it('replaces the previous entry of the dialog instead of adding a second one', () => {
    const first = grade(empty);
    const second = grade(first.file, { symbol: 'MINUS', replaces: first.entryId });
    const entries = second.file.days.flatMap((d) => d.entries);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ symbol: 'MINUS' });
    expect(entries[0]!.id).not.toBe(first.entryId);
  });

  it('removes the entry when the symbol is null and drops an empty day', () => {
    const first = grade(empty);
    const removed = grade(first.file, { symbol: null, replaces: first.entryId });
    expect(removed.entryId).toBeNull();
    expect(removed.file.days).toEqual([]);
  });

  it('can move an entry to another day only by re-recording it (old one removed)', () => {
    const first = grade(empty, { date: '2026-10-06' });
    const moved = grade(first.file, { replaces: first.entryId });
    expect(moved.file.days.map((d) => d.date)).toEqual(['2026-10-07']);
  });

  it('ignores an unknown entry to replace', () => {
    const first = grade(empty);
    const second = grade(first.file, { studentId: 's2', replaces: 'nope' });
    expect(second.file.days[0]!.entries).toHaveLength(2);
  });

  it('does not mutate its input', () => {
    const first = grade(empty).file;
    const snapshot = structuredClone(first);
    grade(first, { symbol: 'WELLE' });
    expect(first).toEqual(snapshot);
  });
});
