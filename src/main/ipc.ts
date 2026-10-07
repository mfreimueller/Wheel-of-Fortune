import { dialog, ipcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { z } from 'zod';
import { CHANNELS, type PickedFile } from '../shared/api';
import type { RosterImportService } from './rosterImport';
import type { CourseStore } from './store/courseStore';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const courseId = z.string().regex(/^[\w-]+$/);
const importInput = z.object({ text: z.string().max(MAX_CSV_BYTES), schoolYear: z.string().max(20).optional() });

export function registerIpc(store: CourseStore, importer: RosterImportService): void {
  ipcMain.handle(CHANNELS.coursesList, () => store.listCourses());
  ipcMain.handle(CHANNELS.courseLoad, (_event, id: unknown) => store.loadCourse(courseId.parse(id)));

  ipcMain.handle(CHANNELS.rosterPick, async (): Promise<PickedFile> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    const file = filePaths[0];
    if (canceled || !file) return null;
    if ((await stat(file)).size > MAX_CSV_BYTES) return { ok: false, error: 'too-large' };
    return { ok: true, name: basename(file), text: await readFile(file, 'utf-8') };
  });

  ipcMain.handle(CHANNELS.rosterImport, (_event, input: unknown) => importer.importCsv(importInput.parse(input)));
}
