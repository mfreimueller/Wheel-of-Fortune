import { access, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AssessmentsFile, CourseFile } from '../../src/core/schemas';
import { CourseStore, schoolYearFolder } from '../../src/main/store/courseStore';

function course(id: string, schoolYear = '2026/27'): CourseFile {
  return {
    schemaVersion: 1,
    id,
    schoolYear,
    className: '3EHIF',
    subject: 'Informatik',
    archived: false,
    categories: ['Mitarbeit'],
    defaultCategory: 'Mitarbeit',
    students: [
      { id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: '#ffaabb', pickCount: 0, weight: 1, active: true },
    ],
    specials: [],
  };
}

const exists = (path: string) => access(path).then(() => true, () => false);

let dir: string;
let store: CourseStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-store-'));
  store = new CourseStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('schoolYearFolder', () => {
  it('replaces the slash so the year is a safe folder name', () => {
    expect(schoolYearFolder('2026/27')).toBe('2026-27');
  });
});

describe('CourseStore', () => {
  it('saves a course into its school-year folder and loads it back', async () => {
    await store.saveCourse(course('c1'));
    expect(await exists(join(dir, '2026-27', 'c1.course.json'))).toBe(true);
    expect(await store.loadCourse('c1')).toEqual({ ok: true, value: course('c1') });
  });

  it('lists courses of all school years and reports unreadable files instead of failing', async () => {
    await store.saveCourse(course('c1', '2025/26'));
    await store.saveCourse(course('c2', '2026/27'));
    await mkdir(join(dir, '2026-27'), { recursive: true });
    await writeFile(join(dir, '2026-27', 'broken.course.json'), '{ nope');

    const listing = await store.listCourses();
    expect(listing.courses.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    expect(listing.courses.find((c) => c.id === 'c1')).toMatchObject({ schoolYear: '2025/26', className: '3EHIF', subject: 'Informatik', archived: false });
    expect(listing.problems).toHaveLength(1);
    expect(listing.problems[0]!.file).toContain('broken.course.json');
  });

  it('lists nothing for a data folder that does not exist yet', async () => {
    const empty = new CourseStore(join(dir, 'not-created'));
    expect(await empty.listCourses()).toEqual({ courses: [], problems: [] });
  });

  it('reports an unknown course id as missing', async () => {
    expect(await store.loadCourse('nope')).toMatchObject({ ok: false, error: { kind: 'missing' } });
  });

  it('returns an empty assessments document for a course without grades', async () => {
    await store.saveCourse(course('c1'));
    expect(await store.loadAssessments('c1')).toEqual({
      ok: true,
      value: { schemaVersion: 1, courseId: 'c1', days: [] },
    });
  });

  it('round-trips assessments next to the course file', async () => {
    await store.saveCourse(course('c1'));
    const assessments: AssessmentsFile = {
      schemaVersion: 1,
      courseId: 'c1',
      days: [{ date: '2026-10-07', entries: [{ id: 'e1', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', gradedAt: '2026-10-07T09:00:00Z', exportedAt: null }] }],
    };
    await store.saveAssessments(assessments);
    expect(await exists(join(dir, '2026-27', 'c1.assessments.json'))).toBe(true);
    expect(await store.loadAssessments('c1')).toEqual({ ok: true, value: assessments });
  });

  it('moves a deleted course and its grades to .trash instead of unlinking them', async () => {
    await store.saveCourse(course('c1'));
    await store.saveAssessments({ schemaVersion: 1, courseId: 'c1', days: [] });
    await store.moveToTrash('c1');

    expect((await store.listCourses()).courses).toEqual([]);
    expect(await exists(join(dir, '2026-27', 'c1.course.json'))).toBe(false);
    expect(await exists(join(dir, '.trash', '2026-27', 'c1.course.json'))).toBe(true);
    expect(await exists(join(dir, '.trash', '2026-27', 'c1.assessments.json'))).toBe(true);
  });

  it('applies schema defaults to a hand-written minimal course file', async () => {
    await mkdir(join(dir, '2026-27'), { recursive: true });
    await writeFile(
      join(dir, '2026-27', 'hand.course.json'),
      JSON.stringify({ schemaVersion: 1, id: 'hand', schoolYear: '2026/27', className: '4A', subject: 'M', students: [{ id: 's', firstName: 'A', lastName: 'B' }] }),
    );
    const loaded = await store.loadCourse('hand');
    expect(loaded.ok && loaded.value.students[0]).toMatchObject({ pickCount: 0, weight: 1, active: true, color: null });
    expect(loaded.ok && loaded.value.defaultCategory).toBe('Mitarbeit');
  });
});
