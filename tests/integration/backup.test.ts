import { describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { exportBackup, importBackup } from '../../src/services/backup';
import { CorruptStoreError, DB_KEY, LocalStore, StoreWriteError } from '../../src/services/localStore';
import { memoryStorage } from '../helpers/memoryStorage';

const course = (id: string): CourseFile => ({
  schemaVersion: 1, id, schoolYear: '2026/27', className: '3A', subject: 'Info', archived: false,
  categories: [], defaultCategory: 'Mitarbeit', specials: [],
  students: [{ id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: null, pickCount: 4, weight: 1, active: true }],
});

describe('backup', () => {
  it('names the file after the date', () => {
    const file = exportBackup(new LocalStore(memoryStorage()), new Date(2026, 9, 7));
    expect(file.name).toBe('wheel-backup-2026-10-07.json');
  });

  it('round-trips all courses into another store', async () => {
    const source = new LocalStore(memoryStorage());
    await source.saveCourse(course('c1'));
    await source.saveCourse(course('c2'));
    const target = new LocalStore(memoryStorage());
    expect(importBackup(target, exportBackup(source).json)).toEqual({ ok: true, courseCount: 2 });
    expect(await target.loadCourse('c2')).toEqual({ ok: true, value: course('c2') });
  });

  it('replaces existing data completely', async () => {
    const source = new LocalStore(memoryStorage());
    await source.saveCourse(course('new'));
    const target = new LocalStore(memoryStorage());
    await target.saveCourse(course('old'));
    importBackup(target, exportBackup(source).json);
    expect((await target.listCourses()).courses.map((c) => c.id)).toEqual(['new']);
  });

  it('rejects text that is not JSON and keeps the data', async () => {
    const target = new LocalStore(memoryStorage());
    await target.saveCourse(course('keep'));
    expect(importBackup(target, 'nope')).toEqual({ ok: false, error: 'invalid-file' });
    expect((await target.listCourses()).courses).toHaveLength(1);
  });

  it('rejects JSON of the wrong shape', () => {
    const target = new LocalStore(memoryStorage());
    expect(importBackup(target, '{"hello":1}')).toEqual({ ok: false, error: 'invalid-file' });
    expect(importBackup(target, '{"schemaVersion":1,"courses":[{"id":"x"}]}')).toEqual({ ok: false, error: 'invalid-file' });
    expect(importBackup(target, 'null')).toEqual({ ok: false, error: 'invalid-file' });
  });

  it('rejects a newer schema version', () => {
    const target = new LocalStore(memoryStorage());
    expect(importBackup(target, '{"schemaVersion":2,"courses":[]}')).toEqual({ ok: false, error: 'newer-schema' });
  });

  it('can export a store holding no data yet', () => {
    const file = exportBackup(new LocalStore(memoryStorage()));
    expect(JSON.parse(file.json)).toEqual({ schemaVersion: 1, courses: [] });
  });

  it('refuses to export unreadable stored data', () => {
    const store = new LocalStore(memoryStorage({ [DB_KEY]: '{ nope' }));
    expect(() => exportBackup(store)).toThrow(CorruptStoreError);
  });

  it('reports a failing write while restoring instead of claiming success', () => {
    const store = new LocalStore(memoryStorage({}, { failWrites: true }));
    expect(() => importBackup(store, '{"schemaVersion":1,"courses":[]}')).toThrow(StoreWriteError);
  });
});
