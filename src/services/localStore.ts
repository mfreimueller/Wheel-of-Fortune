import { fail, ok, type Result } from '../core/result';
import { CURRENT_SCHEMA_VERSION, dbSchema, type CourseFile, type Db } from '../core/schemas';
import type { CourseListing, ReadError } from '../shared/types';
import type { CourseRepo } from './courseRepo';

export const DB_KEY = 'wof:db';

/** The stored data exists but is not a valid database; carries the raw text so the user can save it. */
export class CorruptStoreError extends Error {
  constructor(
    readonly raw: string,
    readonly reason: 'invalid' | 'newer-schema',
  ) {
    super(reason === 'newer-schema' ? 'Die gespeicherten Daten stammen von einer neueren Version.' : 'Die gespeicherten Daten sind beschädigt.');
    this.name = 'CorruptStoreError';
  }
}

/** The browser refused to store the data (quota exceeded, storage blocked, ...). Nothing was saved. */
export class StoreWriteError extends Error {
  constructor(readonly cause: unknown) {
    super('Speichern fehlgeschlagen.');
    this.name = 'StoreWriteError';
  }
}

/** The whole database lives in one localStorage key, so every write is atomic. */
export class LocalStore implements CourseRepo {
  constructor(private readonly storage: Storage = localStorage) {}

  /** Throws `CorruptStoreError` when the key holds something unusable. */
  read(): Db {
    const raw = this.storage.getItem(DB_KEY);
    if (raw === null) return { schemaVersion: CURRENT_SCHEMA_VERSION, courses: [] };
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new CorruptStoreError(raw, 'invalid');
    }
    const parsed = dbSchema.safeParse(json);
    if (!parsed.success) {
      const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
      throw new CorruptStoreError(raw, typeof version === 'number' && version > CURRENT_SCHEMA_VERSION ? 'newer-schema' : 'invalid');
    }
    return parsed.data;
  }

  /** The unparsed stored text, for the "download and reset" escape hatch. */
  rawData(): string | null {
    return this.storage.getItem(DB_KEY);
  }

  /** Replaces everything (restore of a backup). */
  replaceAll(db: Db): void {
    try {
      this.storage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      throw new StoreWriteError(e);
    }
  }

  reset(): void {
    this.storage.removeItem(DB_KEY);
  }

  async listCourses(): Promise<CourseListing> {
    const courses = this.read().courses.map(({ id, schoolYear, className, subject, archived }) => ({ id, schoolYear, className, subject, archived }));
    return { courses, problems: [] };
  }

  async loadCourse(id: string): Promise<Result<CourseFile, ReadError>> {
    const course = this.read().courses.find((c) => c.id === id);
    if (!course) return fail({ kind: 'missing', file: id, message: 'Kurs nicht gefunden.' });
    return ok(structuredClone(course));
  }

  async saveCourse(course: CourseFile): Promise<void> {
    const db = this.read();
    const copy = structuredClone(course);
    const index = db.courses.findIndex((c) => c.id === course.id);
    if (index >= 0) db.courses[index] = copy;
    else db.courses.push(copy);
    this.replaceAll(db);
  }

  async deleteCourse(id: string): Promise<void> {
    const db = this.read();
    this.replaceAll({ ...db, courses: db.courses.filter((c) => c.id !== id) });
  }
}
