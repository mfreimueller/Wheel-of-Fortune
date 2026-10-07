import { describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { applyStudentPatch, resetPickCounts } from '../../src/core/studentPatch';

const course = (): CourseFile => ({
  schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3A', subject: 'Info', archived: false,
  categories: [], defaultCategory: 'Mitarbeit', specials: [],
  students: [
    { id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: '#ffaabb', pickCount: 3, weight: 1, active: true },
    { id: 's2', graderId: null, firstName: 'Max', lastName: 'Muster', color: null, pickCount: 1, weight: 1, active: true },
  ],
});

describe('applyStudentPatch', () => {
  it('changes only the given fields of the given student', () => {
    const result = applyStudentPatch(course(), 's1', { pickCount: 5 });
    expect(result).toMatchObject({ ok: true });
    const students = result.ok ? result.course.students : [];
    expect(students[0]).toMatchObject({ pickCount: 5, weight: 1, color: '#ffaabb', active: true });
    expect(students[1]).toEqual(course().students[1]);
  });

  it('normalizes a color and allows clearing it', () => {
    const set = applyStudentPatch(course(), 's2', { color: '#FAB' });
    expect(set.ok && set.course.students[1]!.color).toBe('#ffaabb');
    const cleared = applyStudentPatch(course(), 's1', { color: null });
    expect(cleared.ok && cleared.course.students[0]!.color).toBeNull();
  });

  it('can deactivate and reactivate a student', () => {
    const off = applyStudentPatch(course(), 's1', { active: false });
    expect(off.ok && off.course.students[0]!.active).toBe(false);
  });

  it.each([
    [{ color: 'red' }, 'invalid-color'],
    [{ pickCount: -1 }, 'invalid-pick-count'],
    [{ pickCount: 1.5 }, 'invalid-pick-count'],
  ] as const)('rejects %j', (patch, error) => {
    expect(applyStudentPatch(course(), 's1', patch)).toEqual({ ok: false, error });
  });

  it('rejects an unknown student', () => {
    expect(applyStudentPatch(course(), 'zed', { pickCount: 2 })).toEqual({ ok: false, error: 'unknown-student' });
  });

  it('does not mutate its input', () => {
    const input = course();
    applyStudentPatch(input, 's1', { pickCount: 9 });
    expect(input).toEqual(course());
  });
});

describe('resetPickCounts', () => {
  it('sets every count to zero and keeps everything else', () => {
    const reset = resetPickCounts(course());
    expect(reset.students.map((s) => s.pickCount)).toEqual([0, 0]);
    expect(reset.students[0]).toMatchObject({ color: '#ffaabb', weight: 1 });
  });
});
