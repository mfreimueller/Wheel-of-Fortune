import { mkdir, readdir, rename } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fail, ok, type Result } from '../../core/result';
import {
  assessmentsFileSchema,
  courseFileSchema,
  CURRENT_SCHEMA_VERSION,
  type AssessmentsFile,
  type CourseFile,
} from '../../core/schemas';
import type { CourseListing, ReadError } from '../../shared/types';
import { readJsonFile, writeJsonAtomic } from './jsonFile';

const SAFE_ID = /^[\w-]+$/;
const COURSE_SUFFIX = '.course.json';

/** "2026/27" → "2026-27": a safe folder name. */
export function schoolYearFolder(schoolYear: string): string {
  return schoolYear.replace(/[\\/:*?"<>|]/g, '-');
}

/** One folder per school year; each course is `<id>.course.json` plus `<id>.assessments.json`. */
export class CourseStore {
  constructor(private readonly dataDir: string) {}

  async listCourses(): Promise<CourseListing> {
    const listing: CourseListing = { courses: [], problems: [] };
    for (const yearDir of await this.yearDirs()) {
      for (const name of await readNames(join(this.dataDir, yearDir))) {
        if (!name.endsWith(COURSE_SUFFIX)) continue;
        const loaded = await readJsonFile(join(this.dataDir, yearDir, name), courseFileSchema);
        if (!loaded.ok) {
          listing.problems.push(loaded.error);
          continue;
        }
        const { id, schoolYear, className, subject, archived } = loaded.value;
        listing.courses.push({ id, schoolYear, className, subject, archived });
      }
    }
    return listing;
  }

  async loadCourse(id: string): Promise<Result<CourseFile, ReadError>> {
    const file = await this.courseFile(id);
    if (!file) return fail(missing(`${id}${COURSE_SUFFIX}`));
    return readJsonFile(file, courseFileSchema);
  }

  async saveCourse(course: CourseFile): Promise<void> {
    assertSafeId(course.id);
    const file = (await this.courseFile(course.id)) ?? join(this.dataDir, schoolYearFolder(course.schoolYear), `${course.id}${COURSE_SUFFIX}`);
    await writeJsonAtomic(file, course);
  }

  async loadAssessments(courseId: string): Promise<Result<AssessmentsFile, ReadError>> {
    const course = await this.courseFile(courseId);
    if (!course) return fail(missing(`${courseId}${COURSE_SUFFIX}`));
    const loaded = await readJsonFile(assessmentsPath(course), assessmentsFileSchema);
    if (!loaded.ok && loaded.error.kind === 'missing') {
      return ok({ schemaVersion: CURRENT_SCHEMA_VERSION, courseId, days: [] });
    }
    return loaded;
  }

  async saveAssessments(assessments: AssessmentsFile): Promise<void> {
    const course = await this.courseFile(assessments.courseId);
    if (!course) throw new Error(`Kurs ${assessments.courseId} nicht gefunden`);
    await writeJsonAtomic(assessmentsPath(course), assessments);
  }

  /** Deleting never unlinks: all files of the course move to `.trash/<year>/`. */
  async moveToTrash(courseId: string): Promise<void> {
    const course = await this.courseFile(courseId);
    if (!course) throw new Error(`Kurs ${courseId} nicht gefunden`);
    const yearDir = dirname(course);
    const target = join(this.dataDir, '.trash', basename(yearDir));
    await mkdir(target, { recursive: true });
    for (const name of await readNames(yearDir)) {
      if (name.startsWith(`${courseId}.`)) await rename(join(yearDir, name), join(target, name));
    }
  }

  private async yearDirs(): Promise<string[]> {
    try {
      const entries = await readdir(this.dataDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
    } catch {
      return [];
    }
  }

  private async courseFile(id: string): Promise<string | null> {
    assertSafeId(id);
    for (const yearDir of await this.yearDirs()) {
      if ((await readNames(join(this.dataDir, yearDir))).includes(`${id}${COURSE_SUFFIX}`)) {
        return join(this.dataDir, yearDir, `${id}${COURSE_SUFFIX}`);
      }
    }
    return null;
  }
}

const assessmentsPath = (courseFile: string): string => courseFile.slice(0, -COURSE_SUFFIX.length) + '.assessments.json';

function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error(`Ungültige Kurs-ID: ${id}`);
}

function missing(file: string): ReadError {
  return { kind: 'missing', file, message: 'Datei nicht gefunden.', backupAvailable: false };
}

async function readNames(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
