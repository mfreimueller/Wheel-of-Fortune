import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CourseFile } from '../../src/core/schemas';
import { ExportService } from '../../src/main/exportService';
import { CourseStore } from '../../src/main/store/courseStore';

const course: CourseFile = {
  schemaVersion: 1, id: 'c1', schoolYear: '2026/27', className: '3EHIF', subject: 'DBIx - Modellierung', archived: false,
  categories: ['Mitarbeit'], defaultCategory: 'Mitarbeit',
  students: [{ id: 's1', graderId: null, firstName: 'Anna', lastName: 'Bob', color: null, pickCount: 1, weight: 1, active: true }],
  specials: [],
};

let dir: string;
let store: CourseStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-export-'));
  store = new CourseStore(dir);
  await store.saveCourse(course);
  await store.saveAssessments({
    schemaVersion: 1,
    courseId: 'c1',
    days: [{ date: '2026-10-07', entries: [{ id: 'e1', studentId: 's1', category: 'Mitarbeit', symbol: 'PLUS', gradedAt: '2026-10-07T09:00:00.000Z', exportedAt: null }] }],
  });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const service = () => new ExportService(store, () => new Date('2026-10-08T08:00:00Z'));

describe('ExportService', () => {
  it('summarizes new and total entries', async () => {
    expect(await service().summary('c1')).toEqual({ ok: true, newCount: 1, totalCount: 1 });
  });

  it('saves the CSV and marks the entries as exported only after the save succeeded', async () => {
    let saved: { name: string; csv: string } | null = null;
    const outcome = await service().run('c1', 'new', async (name, csv) => {
      saved = { name, csv };
      return '/tmp/out.csv';
    });
    expect(outcome).toEqual({ ok: true, filePath: '/tmp/out.csv', count: 1, warnings: [] });
    expect(saved).toMatchObject({ name: '3EHIF_DBIx_-_Modellierung_Aufrufe.csv' });
    expect(saved!.csv).toContain('Bob;Anna;Mitarbeit;Aufruf (Mitarbeit);07.10.2026;;+');
    expect(await service().summary('c1')).toEqual({ ok: true, newCount: 0, totalCount: 1 });
  });

  it('leaves entries unexported when the save dialog is cancelled', async () => {
    expect(await service().run('c1', 'new', async () => null)).toEqual({ ok: true, filePath: null, count: 0, warnings: [] });
    expect(await service().summary('c1')).toEqual({ ok: true, newCount: 1, totalCount: 1 });
  });

  it('exports already exported entries again with scope "all"', async () => {
    await service().run('c1', 'new', async () => '/tmp/a.csv');
    const again = await service().run('c1', 'all', async () => '/tmp/b.csv');
    expect(again).toMatchObject({ ok: true, count: 1 });
  });

  it('reports an unreadable course', async () => {
    expect(await service().summary('nope')).toEqual({ ok: false, error: 'course-unreadable' });
  });
});
