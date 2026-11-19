import { z } from 'zod';
import { specialSchema } from '../core/schemas';
import type { WheelApi } from '../shared/api';
import { exportBackup, importBackup } from '../services/backup';
import { CourseEditService } from '../services/courseEditService';
import { CorruptStoreError, LocalStore } from '../services/localStore';
import { PickService } from '../services/pickService';
import { RosterImportService } from '../services/rosterImport';
import { DB_KEY } from '../services/localStore';
import { download, pickTextFile } from './files';

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const LAST_BACKUP_KEY = 'wof:lastBackupAt';

const specialsInput = z.array(specialSchema).max(30);

/** Wires the services to the `WheelApi` the UI talks to; everything runs in the page. */
export function createBrowserApi(store: LocalStore = new LocalStore()): WheelApi {
  const importer = new RosterImportService(store, (prefix) => `${prefix}_${crypto.randomUUID()}`);
  const picker = new PickService(store);
  const editor = new CourseEditService(store);

  return {
    courses: {
      list: async () => {
        try {
          return await store.listCourses();
        } catch (e) {
          if (!(e instanceof CorruptStoreError)) throw e;
          return { courses: [], problems: [{ kind: e.reason === 'newer-schema' ? 'newer-schema' : 'invalid', file: DB_KEY, message: e.message }] };
        }
      },
      load: (id) => store.loadCourse(id),
      updateStudent: ({ courseId, studentId, patch }) => editor.updateStudent(courseId, studentId, patch),
      resetPickCounts: (courseId) => editor.resetPickCounts(courseId),
      setArchived: ({ courseId, archived }) => editor.setArchived(courseId, archived),
      delete: (courseId) => editor.deleteCourse(courseId),
      setSpecials: ({ courseId, specials }) => editor.setSpecials(courseId, specialsInput.parse(specials)),
    },
    roster: {
      pick: () => pickTextFile('.csv,text/csv', MAX_CSV_BYTES),
      import: (input) => importer.importCsv(input),
    },
    pick: {
      draw: ({ courseId, fair, absentIds }) => picker.draw(courseId, { fair, absentIds }),
      student: ({ courseId, studentId }) => picker.pickStudent(courseId, studentId),
    },
    backup: {
      export: async () => {
        let file;
        try {
          file = exportBackup(store);
        } catch (e) {
          if (e instanceof CorruptStoreError) return { ok: false, error: 'corrupt' };
          throw e;
        }
        download(file.name, file.json, 'application/json');
        try {
          localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
        } catch {
          // Not being able to remember the date must not fail the backup.
        }
        return { ok: true };
      },
      import: async () => {
        const picked = await pickTextFile('.json,application/json', MAX_BACKUP_BYTES);
        if (!picked) return null;
        if (!picked.ok) return { ok: false, error: 'too-large' };
        return importBackup(store, picked.text);
      },
      lastBackupAt: () => {
        try {
          return localStorage.getItem(LAST_BACKUP_KEY);
        } catch {
          return null;
        }
      },
      downloadRaw: async () => {
        download('wheel-raw-data.json', store.rawData() ?? '', 'application/json');
      },
      reset: async () => {
        store.reset();
      },
    },
  };
}
