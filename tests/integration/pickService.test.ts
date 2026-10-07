import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { PickService } from '../../src/main/pickService';
import { CourseStore } from '../../src/main/store/courseStore';

function course(overrides: Partial<CourseFile> = {}): CourseFile {
  const student = (id: string, pickCount = 0, active = true) => ({
    id, graderId: null, firstName: id, lastName: 'Test', color: null, pickCount, weight: 1, active,
  });
  return {
    schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3A', subject: 'Info', archived: false,
    categories: [], defaultCategory: 'Mitarbeit',
    students: [student('anna'), student('bob', 1), student('cleo', 0, false)],
    specials: [],
    ...overrides,
  };
}

const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0;
};

let dir: string;
let store: CourseStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-pick-'));
  store = new CourseStore(dir);
  await store.saveCourse(course());
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const counts = async () => {
  const loaded = await store.loadCourse('c1');
  if (!loaded.ok) throw new Error('course unreadable');
  return Object.fromEntries(loaded.value.students.map((s) => [s.id, s.pickCount]));
};

describe('PickService.draw', () => {
  it('draws from the fair pool and persists the new count before returning', async () => {
    const service = new PickService(store, sequence(0));
    const outcome = await service.draw('c1', { fair: true, absentIds: [] });
    expect(outcome).toEqual({
      ok: true,
      spins: [{ kind: 'student', studentId: 'anna' }],
      picked: { studentId: 'anna', firstName: 'anna', lastName: 'Test', color: null, pickCount: 1 },
    });
    expect(await counts()).toEqual({ anna: 1, bob: 1, cleo: 0 });
  });

  it('counts picks in free mode as well', async () => {
    const service = new PickService(store, sequence(0.99)); // second eligible student: bob
    await service.draw('c1', { fair: false, absentIds: [] });
    expect(await counts()).toEqual({ anna: 0, bob: 2, cleo: 0 });
  });

  it('never draws absent or inactive students', async () => {
    const service = new PickService(store, sequence(0));
    const outcome = await service.draw('c1', { fair: false, absentIds: ['anna'] });
    expect(outcome).toMatchObject({ ok: true, picked: { studentId: 'bob' } });
  });

  it('changes nothing for a message special', async () => {
    await store.saveCourse(course({ specials: [{ id: 'sp', label: 'Test!', color: '#ed1943', kind: 'message', message: 'Blatt raus', probability: 50, showIn: 'always' }] }));
    const service = new PickService(store, sequence(0.1));
    const outcome = await service.draw('c1', { fair: false, absentIds: [] });
    expect(outcome).toMatchObject({ ok: true, picked: null, spins: [{ kind: 'special', special: { id: 'sp' } }] });
    expect(await counts()).toEqual({ anna: 0, bob: 1, cleo: 0 });
  });

  it('counts only the final student after spin-again results', async () => {
    await store.saveCourse(course({ specials: [{ id: 'again', label: 'Nochmal', color: '#6d28d9', kind: 'spin-again', probability: 50, showIn: 'always' }] }));
    const service = new PickService(store, sequence(0.1, 0.1, 0.9, 0));
    const outcome = await service.draw('c1', { fair: false, absentIds: [] });
    expect(outcome.ok && outcome.spins.map((s) => s.kind)).toEqual(['special', 'special', 'student']);
    expect(Object.values(await counts()).reduce((a, b) => a + b, 0)).toBe(2); // 1 existing + exactly 1 new
  });

  it('fails without saving when nobody is eligible', async () => {
    const service = new PickService(store, sequence(0));
    const outcome = await service.draw('c1', { fair: false, absentIds: ['anna', 'bob'] });
    expect(outcome).toEqual({ ok: false, error: 'no-eligible-students' });
    expect(await counts()).toEqual({ anna: 0, bob: 1, cleo: 0 });
  });

  it('reports an unknown course', async () => {
    const outcome = await new PickService(store, sequence(0)).draw('nope', { fair: true, absentIds: [] });
    expect(outcome).toEqual({ ok: false, error: 'course-unreadable' });
  });
});

describe('PickService.pickStudent', () => {
  it('increments the chosen student directly', async () => {
    const outcome = await new PickService(store).pickStudent('c1', 'bob');
    expect(outcome).toMatchObject({ ok: true, picked: { studentId: 'bob', pickCount: 2 }, spins: [{ kind: 'student', studentId: 'bob' }] });
    expect(await counts()).toEqual({ anna: 0, bob: 2, cleo: 0 });
  });

  it('rejects inactive and unknown students', async () => {
    const service = new PickService(store);
    expect(await service.pickStudent('c1', 'cleo')).toEqual({ ok: false, error: 'unknown-student' });
    expect(await service.pickStudent('c1', 'zed')).toEqual({ ok: false, error: 'unknown-student' });
  });
});
