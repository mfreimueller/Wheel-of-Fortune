import { describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import type { ParsedRoster } from '../../src/core/rosterCsv';
import { mergeRoster } from '../../src/core/rosterMerge';

let counter = 0;
const newId = (prefix: string) => `${prefix}_${++counter}`;

function roster(students: ParsedRoster['students'], overrides: Partial<Omit<ParsedRoster, 'schoolYear'>> = {}): ParsedRoster & { schoolYear: string } {
  return { className: '3EHIF', subject: 'Info', schoolYear: '2026/27', categories: null, students, warnings: [], ...overrides };
}

const anna = { graderId: 'g1', firstName: 'Anna', lastName: 'Bob', color: '#ffaabb' };
const max = { graderId: 'g2', firstName: 'Maxi', lastName: 'Muster', color: null };

function created(students: ParsedRoster['students'], overrides: Partial<Omit<ParsedRoster, 'schoolYear'>> = {}): CourseFile {
  return mergeRoster(null, roster(students, overrides), newId).course;
}

describe('mergeRoster: new course', () => {
  it('creates a course with defaults for every student', () => {
    const { course, report } = mergeRoster(null, roster([anna, max], { categories: ['Mitarbeit', 'Wiederholung'] }), newId);
    expect(course).toMatchObject({ schemaVersion: 1, schoolYear: '2026/27', className: '3EHIF', subject: 'Info', archived: false, categories: ['Mitarbeit', 'Wiederholung'], specials: [] });
    expect(course.students[0]).toMatchObject({ graderId: 'g1', firstName: 'Anna', color: '#ffaabb', pickCount: 0, weight: 1, active: true });
    expect(course.id).toMatch(/^c_/);
    expect(new Set(course.students.map((s) => s.id)).size).toBe(2);
    expect(report).toMatchObject({ courseCreated: true, added: 2, updated: 0, reactivated: 0, deactivated: 0 });
  });

  it('keeps the default categories when the CSV has none', () => {
    expect(created([anna]).categories).toEqual([]);
  });
});

describe('mergeRoster: existing course', () => {
  it('is a no-op when the same file is imported twice', () => {
    const first = created([anna, max]);
    const second = mergeRoster(first, roster([anna, max]), newId);
    expect(second.course).toEqual(first);
    expect(second.report).toMatchObject({ courseCreated: false, added: 0, updated: 0, reactivated: 0, deactivated: 0 });
  });

  it('only updates the color of a known student and keeps counts, weight and specials', () => {
    const first = created([anna, max]);
    const edited: CourseFile = {
      ...first,
      specials: [{ id: 'sp', label: 'Nochmal', color: '#6d28d9', kind: 'spin-again', probability: 5, showIn: 'always' }],
      students: first.students.map((s) => (s.graderId === 'g1' ? { ...s, pickCount: 4, weight: 2 } : s)),
    };
    const { course, report } = mergeRoster(edited, roster([{ ...anna, color: '#112233' }, max]), newId);
    expect(course.students[0]).toMatchObject({ color: '#112233', pickCount: 4, weight: 2 });
    expect(course.specials).toEqual(edited.specials);
    expect(report.updated).toBe(1);
  });

  it('keeps the local color when the CSV has none', () => {
    const first = created([anna]);
    const { course } = mergeRoster(first, roster([{ ...anna, color: null }]), newId);
    expect(course.students[0]!.color).toBe('#ffaabb');
  });

  it('adds new students', () => {
    const first = created([anna]);
    const { course, report } = mergeRoster(first, roster([anna, max]), newId);
    expect(course.students.map((s) => s.firstName)).toEqual(['Anna', 'Maxi']);
    expect(report.added).toBe(1);
  });

  it('deactivates students that left the export and reactivates them when they return', () => {
    const first = created([anna, max]);
    const left = mergeRoster(first, roster([anna]), newId);
    expect(left.course.students[1]).toMatchObject({ firstName: 'Maxi', active: false });
    expect(left.report.deactivated).toBe(1);

    const back = mergeRoster(left.course, roster([anna, max]), newId);
    expect(back.course.students[1]!.active).toBe(true);
    expect(back.report.reactivated).toBe(1);
  });

  it('keeps a deactivated student already inactive without counting it again', () => {
    const first = created([anna, max]);
    const left = mergeRoster(first, roster([anna]), newId);
    const again = mergeRoster(left.course, roster([anna]), newId);
    expect(again.report.deactivated).toBe(0);
  });

  it('follows a rename when the student is matched by Id', () => {
    const first = created([anna]);
    const { course } = mergeRoster(first, roster([{ ...anna, lastName: 'Bobby' }]), newId);
    expect(course.students).toHaveLength(1);
    expect(course.students[0]).toMatchObject({ firstName: 'Anna', lastName: 'Bobby' });
  });

  it('matches by normalized name when there is no Id and adopts the Id later', () => {
    const legacy = created([{ graderId: null, firstName: 'Jörg', lastName: 'Müller', color: null }]);
    const { course, report } = mergeRoster(legacy, roster([{ graderId: 'g9', firstName: 'Jörg', lastName: 'MÜLLER', color: '#010203' }]), newId);
    expect(course.students).toHaveLength(1);
    expect(course.students[0]).toMatchObject({ graderId: 'g9', color: '#010203', firstName: 'Jörg' });
    expect(report.added).toBe(0);
  });

  it('does not match a student with a different Id even if the name is equal', () => {
    const first = created([anna]);
    const { course } = mergeRoster(first, roster([{ ...anna, graderId: 'other' }]), newId);
    expect(course.students).toHaveLength(2);
    expect(course.students[0]!.active).toBe(false);
  });

  it('replaces the categories only when the CSV provides them', () => {
    const first = created([anna], { categories: ['Mitarbeit'] });
    expect(mergeRoster(first, roster([anna], { categories: null }), newId).course.categories).toEqual(['Mitarbeit']);
    expect(mergeRoster(first, roster([anna], { categories: ['Mitarbeit', 'Test'] }), newId).course.categories).toEqual(['Mitarbeit', 'Test']);
  });
});

describe('mergeRoster: duplicate names without Id', () => {
  const dup = { graderId: null, firstName: 'Anna', lastName: 'Bob', color: '#111111' };

  it('adds both and warns', () => {
    const { course, report } = mergeRoster(null, roster([dup, { ...dup, color: '#222222' }]), newId);
    expect(course.students).toHaveLength(2);
    expect(report.warnings).toContainEqual({ code: 'duplicate-name', detail: 'Anna Bob' });
  });

  it('leaves ambiguous students untouched on re-import instead of guessing', () => {
    const first = created([dup, { ...dup, color: '#222222' }]);
    const { course, report } = mergeRoster(first, roster([{ ...dup, color: '#333333' }, { ...dup, color: '#444444' }]), newId);
    expect(course.students.map((s) => s.color)).toEqual(['#111111', '#222222']);
    expect(course.students.every((s) => s.active)).toBe(true);
    expect(report.warnings).toContainEqual({ code: 'duplicate-name', detail: 'Anna Bob' });
  });
});
