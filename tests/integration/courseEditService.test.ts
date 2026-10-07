import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { CourseEditService } from '../../src/main/courseEditService';
import { CourseStore } from '../../src/main/store/courseStore';

const course: CourseFile = {
  schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3A', subject: 'Info', archived: false,
  categories: [], defaultCategory: 'Mitarbeit', specials: [],
  students: [{ id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: null, pickCount: 3, weight: 1, active: true }],
};

let dir: string;
let store: CourseStore;
let service: CourseEditService;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-edit-'));
  store = new CourseStore(dir);
  await store.saveCourse(course);
  service = new CourseEditService(store);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('CourseEditService', () => {
  it('persists a student patch', async () => {
    expect(await service.updateStudent('c1', 's1', { weight: 3 })).toEqual({ ok: true });
    const loaded = await store.loadCourse('c1');
    expect(loaded.ok && loaded.value.students[0]).toMatchObject({ weight: 3, pickCount: 3 });
  });

  it('reports validation errors without saving', async () => {
    expect(await service.updateStudent('c1', 's1', { weight: -2 })).toEqual({ ok: false, error: 'invalid-weight' });
    const loaded = await store.loadCourse('c1');
    expect(loaded.ok && loaded.value.students[0]!.weight).toBe(1);
  });

  it('resets all pick counts', async () => {
    expect(await service.resetPickCounts('c1')).toEqual({ ok: true });
    const loaded = await store.loadCourse('c1');
    expect(loaded.ok && loaded.value.students[0]!.pickCount).toBe(0);
  });

  it('reports an unknown course', async () => {
    expect(await service.updateStudent('nope', 's1', {})).toEqual({ ok: false, error: 'course-unreadable' });
    expect(await service.resetPickCounts('nope')).toEqual({ ok: false, error: 'course-unreadable' });
  });
});
