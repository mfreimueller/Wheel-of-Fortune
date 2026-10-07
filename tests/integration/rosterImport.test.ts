import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CourseStore } from '../../src/main/store/courseStore';
import { RosterImportService } from '../../src/main/rosterImport';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf-8');

let dir: string;
let store: CourseStore;
let service: RosterImportService;
let counter = 0;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-import-'));
  store = new CourseStore(dir);
  counter = 0;
  service = new RosterImportService(store, (prefix) => `${prefix}_${++counter}`, () => new Date(2026, 9, 7));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('RosterImportService', () => {
  it('creates the course from a complete export and persists it', async () => {
    const outcome = await service.importCsv({ text: fixture('grader-roster.csv') });
    expect(outcome).toMatchObject({ status: 'imported', report: { courseCreated: true, added: 3 } });
    const { courses } = await store.listCourses();
    expect(courses).toMatchObject([{ schoolYear: '2026/27', className: '3EHIF', subject: 'DBIx - Modellierung' }]);
  });

  it('importing the same file again does not change the stored course', async () => {
    await service.importCsv({ text: fixture('grader-roster.csv') });
    const [summary] = (await store.listCourses()).courses;
    const before = await store.loadCourse(summary!.id);

    const outcome = await service.importCsv({ text: fixture('grader-roster.csv') });
    expect(outcome).toMatchObject({ status: 'imported', report: { courseCreated: false, added: 0, updated: 0 } });
    expect(await store.loadCourse(summary!.id)).toEqual(before);
    expect((await store.listCourses()).courses).toHaveLength(1);
  });

  it('asks for the school year when the CSV has none and suggests the current one', async () => {
    const outcome = await service.importCsv({ text: fixture('grader-roster-legacy.csv') });
    expect(outcome).toEqual({ status: 'needs-school-year', suggested: '2026/27' });
    expect((await store.listCourses()).courses).toEqual([]);
  });

  it('uses the school year the user entered', async () => {
    const outcome = await service.importCsv({ text: fixture('grader-roster-legacy.csv'), schoolYear: '2025-2026' });
    expect(outcome).toMatchObject({ status: 'imported' });
    expect((await store.listCourses()).courses[0]).toMatchObject({ schoolYear: '2025/26' });
  });

  it('rejects an invalid entered school year by asking again', async () => {
    const outcome = await service.importCsv({ text: fixture('grader-roster-legacy.csv'), schoolYear: 'soon' });
    expect(outcome).toEqual({ status: 'needs-school-year', suggested: '2026/27' });
  });

  it('keeps the same class and subject in different school years apart', async () => {
    await service.importCsv({ text: fixture('grader-roster-legacy.csv'), schoolYear: '2025/26' });
    await service.importCsv({ text: fixture('grader-roster-legacy.csv'), schoolYear: '2026/27' });
    expect((await store.listCourses()).courses.map((c) => c.schoolYear).sort()).toEqual(['2025/26', '2026/27']);
  });

  it('reports a parse error without writing anything', async () => {
    const outcome = await service.importCsv({ text: 'Klasse,Fach\n3A,Info\n' });
    expect(outcome).toEqual({ status: 'error', error: { code: 'missing-column', detail: 'Vorname' } });
    expect((await store.listCourses()).courses).toEqual([]);
  });
});
