import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { GradingService } from '../../src/main/gradingService';
import { CourseStore } from '../../src/main/store/courseStore';

const course: CourseFile = {
  schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3A', subject: 'Info', archived: false,
  categories: ['Mitarbeit'], defaultCategory: 'Mitarbeit',
  students: [{ id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: null, pickCount: 1, weight: 1, active: true }],
  specials: [],
};

let dir: string;
let store: CourseStore;
let service: GradingService;
let counter = 0;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-grade-'));
  store = new CourseStore(dir);
  await store.saveCourse(course);
  counter = 0;
  service = new GradingService(store, () => new Date(2026, 9, 7, 9, 14), (prefix) => `${prefix}_${++counter}`);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const entries = async () => {
  const loaded = await store.loadAssessments('c1');
  if (!loaded.ok) throw new Error('unreadable');
  return loaded.value.days.flatMap((d) => d.entries.map((e) => ({ date: d.date, ...e })));
};

describe('GradingService.set', () => {
  it('records a grade for today and persists it', async () => {
    const outcome = await service.set({ courseId: 'c1', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS' });
    expect(outcome).toEqual({ ok: true, entryId: 'e_1' });
    expect(await entries()).toMatchObject([{ date: '2026-10-07', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', exportedAt: null }]);
  });

  it('replaces and removes the dialog entry', async () => {
    const first = await service.set({ courseId: 'c1', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS' });
    const entryId = first.ok ? first.entryId : null;
    await service.set({ courseId: 'c1', studentId: 's1', category: 'Mitarbeit', symbol: 'MINUS', replaces: entryId });
    expect(await entries()).toMatchObject([{ symbol: 'MINUS' }]);

    await service.set({ courseId: 'c1', studentId: 's1', category: 'Mitarbeit', symbol: null, replaces: 'e_2' });
    expect(await entries()).toEqual([]);
  });

  it('rejects students that are not in the course', async () => {
    expect(await service.set({ courseId: 'c1', studentId: 'zed', category: 'Mitarbeit', symbol: 'PLUS' })).toEqual({ ok: false, error: 'unknown-student' });
    expect(await entries()).toEqual([]);
  });

  it('reports an unknown course', async () => {
    expect(await service.set({ courseId: 'nope', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS' })).toEqual({ ok: false, error: 'course-unreadable' });
  });
});
