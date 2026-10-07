import { app, dialog, ipcMain, shell } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { specialSchema } from '../core/schemas';
import { CHANNELS, type PickedFile } from '../shared/api';
import type { DataDirInfo } from '../shared/types';
import { writeConfig } from './config';
import type { CourseEditService } from './courseEditService';
import type { ExportService } from './exportService';
import type { GradingService } from './gradingService';
import type { PickService } from './pickService';
import type { RosterImportService } from './rosterImport';
import type { CourseStore } from './store/courseStore';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const courseId = z.string().regex(/^[\w-]+$/);
const drawInput = z.object({ courseId, fair: z.boolean(), absentIds: z.array(z.string().max(100)).max(500) });
const pickInput = z.object({ courseId, studentId: z.string().min(1).max(100) });
const gradeInput = z.object({
  courseId,
  studentId: z.string().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  symbol: z.enum(['PLUS', 'WELLE', 'MINUS']).nullable(),
  replaces: z.string().max(100).nullable().optional(),
});
const studentUpdateInput = z.object({
  courseId,
  studentId: z.string().min(1).max(100),
  patch: z
    .object({
      color: z.string().max(20).nullable().optional(),
      pickCount: z.number().int().min(0).max(100000).optional(),
      weight: z.number().min(0).max(100).optional(),
      active: z.boolean().optional(),
    })
    .strict(),
});
const specialsInput = z.object({ courseId, specials: z.array(specialSchema).max(30) });
const archiveInput = z.object({ courseId, archived: z.boolean() });
const exportInput = z.object({ courseId, scope: z.enum(['new', 'all']) });
const importInput = z.object({ text: z.string().max(MAX_CSV_BYTES), schoolYear: z.string().max(20).optional() });

export interface Services {
  store: CourseStore;
  importer: RosterImportService;
  picker: PickService;
  grader: GradingService;
  exporter: ExportService;
  editor: CourseEditService;
  settings: { info: DataDirInfo; userData: string };
}

export function registerIpc({ store, importer, picker, grader, exporter, editor, settings }: Services): void {
  ipcMain.handle(CHANNELS.coursesList, () => store.listCourses());
  ipcMain.handle(CHANNELS.courseLoad, (_event, id: unknown) => store.loadCourse(courseId.parse(id)));

  ipcMain.handle(CHANNELS.studentUpdate, (_event, input: unknown) => {
    const { courseId: id, studentId, patch } = studentUpdateInput.parse(input);
    return editor.updateStudent(id, studentId, patch);
  });
  ipcMain.handle(CHANNELS.specialsSet, (_event, input: unknown) => {
    const { courseId: id, specials } = specialsInput.parse(input);
    return editor.setSpecials(id, specials);
  });
  ipcMain.handle(CHANNELS.courseArchive, (_event, input: unknown) => {
    const { courseId: id, archived } = archiveInput.parse(input);
    return editor.setArchived(id, archived);
  });
  ipcMain.handle(CHANNELS.courseDelete, (_event, id: unknown) => editor.deleteCourse(courseId.parse(id)));

  ipcMain.handle(CHANNELS.settingsGet, () => settings.info);
  ipcMain.handle(CHANNELS.settingsChoose, async () => {
    if (settings.info.source === 'env') return { ok: false, error: 'locked' } as const;
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    const dataDir = filePaths[0];
    if (canceled || !dataDir) return null;
    // The folder is only pointed to, never moved: existing files stay where they are.
    await writeConfig(settings.userData, { dataDir });
    app.relaunch();
    app.exit(0);
    return { ok: true } as const;
  });
  ipcMain.handle(CHANNELS.settingsReveal, async () => {
    await shell.openPath(settings.info.dataDir);
  });
  ipcMain.handle(CHANNELS.countsReset, (_event, id: unknown) => editor.resetPickCounts(courseId.parse(id)));

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

  ipcMain.handle(CHANNELS.pickDraw, (_event, input: unknown) => {
    const { courseId: id, fair, absentIds } = drawInput.parse(input);
    return picker.draw(id, { fair, absentIds });
  });
  ipcMain.handle(CHANNELS.exportSummary, (_event, id: unknown) => exporter.summary(courseId.parse(id)));
  ipcMain.handle(CHANNELS.exportRun, (_event, input: unknown) => {
    const { courseId: id, scope } = exportInput.parse(input);
    return exporter.run(id, scope, async (suggestedName, csv) => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('documents'), suggestedName),
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (canceled || !filePath) return null;
      await writeFile(filePath, csv, 'utf-8');
      return filePath;
    });
  });
  ipcMain.handle(CHANNELS.gradeSet, (_event, input: unknown) => grader.set(gradeInput.parse(input)));
  ipcMain.handle(CHANNELS.pickStudent, (_event, input: unknown) => {
    const { courseId: id, studentId } = pickInput.parse(input);
    return picker.pickStudent(id, studentId);
  });
}
