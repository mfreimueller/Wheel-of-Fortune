import { beforeEach, describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { CorruptStoreError, DB_KEY, LocalStore, StoreWriteError } from '../../src/services/localStore';
import { memoryStorage } from '../helpers/memoryStorage';

function course(id: string, schoolYear = '2026/27'): CourseFile {
  return {
    schemaVersion: 1, id, schoolYear, className: '3EHIF', subject: 'Informatik', archived: false,
    categories: [], defaultCategory: 'Mitarbeit', specials: [],
    students: [{ id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: '#ffaabb', pickCount: 0, weight: 1, active: true }],
  };
}

let storage: Storage;
let store: LocalStore;
beforeEach(() => {
  storage = memoryStorage();
  store = new LocalStore(storage);
});

describe('LocalStore', () => {
  it('starts empty without writing anything', async () => {
    expect(await store.listCourses()).toEqual({ courses: [], problems: [] });
    expect(storage.getItem(DB_KEY)).toBeNull();
  });

  it('saves a course under a single key and loads it back', async () => {
    await store.saveCourse(course('c1'));
    expect(storage.length).toBe(1);
    expect(await store.loadCourse('c1')).toEqual({ ok: true, value: course('c1') });
  });

  it('replaces a course with the same id instead of duplicating it', async () => {
    await store.saveCourse(course('c1'));
    await store.saveCourse({ ...course('c1'), archived: true });
    const { courses } = await store.listCourses();
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ id: 'c1', archived: true });
  });

  it('lists courses of all school years', async () => {
    await store.saveCourse(course('c1', '2025/26'));
    await store.saveCourse(course('c2', '2026/27'));
    const { courses } = await store.listCourses();
    expect(courses.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(courses[0]).toMatchObject({ schoolYear: '2025/26', className: '3EHIF', subject: 'Informatik', archived: false });
  });

  it('returns copies, so mutating a loaded course changes nothing until it is saved', async () => {
    await store.saveCourse(course('c1'));
    const loaded = await store.loadCourse('c1');
    if (loaded.ok) loaded.value.students[0]!.pickCount = 9;
    const again = await store.loadCourse('c1');
    expect(again.ok && again.value.students[0]!.pickCount).toBe(0);
  });

  it('reports an unknown course id as missing', async () => {
    expect(await store.loadCourse('nope')).toMatchObject({ ok: false, error: { kind: 'missing' } });
  });

  it('deletes a course', async () => {
    await store.saveCourse(course('c1'));
    await store.saveCourse(course('c2'));
    await store.deleteCourse('c1');
    expect((await store.listCourses()).courses.map((c) => c.id)).toEqual(['c2']);
  });

  it('applies schema defaults to hand-written minimal data', async () => {
    storage.setItem(DB_KEY, JSON.stringify({ schemaVersion: 1, courses: [{ schemaVersion: 1, id: 'hand', schoolYear: '2026/27', className: '4A', subject: 'M', students: [{ id: 's', firstName: 'A', lastName: 'B' }] }] }));
    const loaded = await store.loadCourse('hand');
    expect(loaded.ok && loaded.value.students[0]).toMatchObject({ pickCount: 0, weight: 1, active: true, color: null });
  });

  it('throws a CorruptStoreError carrying the raw text for unparsable data', async () => {
    storage.setItem(DB_KEY, '{ nope');
    await expect(store.listCourses()).rejects.toMatchObject({ name: 'CorruptStoreError', raw: '{ nope', reason: 'invalid' });
    await expect(store.listCourses()).rejects.toBeInstanceOf(CorruptStoreError);
    expect(store.rawData()).toBe('{ nope');
  });

  it('throws for data of the wrong shape and flags a newer schema', async () => {
    storage.setItem(DB_KEY, JSON.stringify({ schemaVersion: 1, courses: 'x' }));
    await expect(store.listCourses()).rejects.toMatchObject({ reason: 'invalid' });
    storage.setItem(DB_KEY, JSON.stringify({ schemaVersion: 2, courses: [] }));
    await expect(store.listCourses()).rejects.toMatchObject({ reason: 'newer-schema' });
  });

  it('never overwrites corrupt data by saving', async () => {
    storage.setItem(DB_KEY, '{ nope');
    await expect(store.saveCourse(course('c1'))).rejects.toBeInstanceOf(CorruptStoreError);
    expect(storage.getItem(DB_KEY)).toBe('{ nope');
  });

  it('reset removes the data', async () => {
    await store.saveCourse(course('c1'));
    store.reset();
    expect((await store.listCourses()).courses).toEqual([]);
  });

  it('turns a failing write (quota, blocked storage) into a StoreWriteError and keeps the old data', async () => {
    const options = { failWrites: false };
    const flaky = new LocalStore(memoryStorage({}, options));
    await flaky.saveCourse(course('c1'));
    options.failWrites = true;
    await expect(flaky.saveCourse(course('c2'))).rejects.toBeInstanceOf(StoreWriteError);
    await expect(flaky.deleteCourse('c1')).rejects.toBeInstanceOf(StoreWriteError);
    options.failWrites = false;
    expect((await flaky.listCourses()).courses.map((c) => c.id)).toEqual(['c1']);
  });
});
