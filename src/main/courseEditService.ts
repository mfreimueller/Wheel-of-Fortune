import { validateSpecials } from '../core/draw';
import type { Special } from '../core/types';
import { applyStudentPatch, resetPickCounts, type StudentPatch } from '../core/studentPatch';
import type { EditOutcome } from '../shared/types';
import type { CourseStore } from './store/courseStore';

/** Edits that the teacher makes in the student panel. */
export class CourseEditService {
  constructor(private readonly store: CourseStore) {}

  async updateStudent(courseId: string, studentId: string, patch: StudentPatch): Promise<EditOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    const result = applyStudentPatch(loaded.value, studentId, patch);
    if (!result.ok) return result;
    await this.store.saveCourse(result.course);
    return { ok: true };
  }

  /** Replaces all special segments of the course. */
  async setSpecials(courseId: string, specials: Special[]): Promise<EditOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    if (new Set(specials.map((s) => s.id)).size !== specials.length) return { ok: false, error: 'duplicate-id' };
    const valid = validateSpecials(specials);
    if (!valid.ok) return valid;
    await this.store.saveCourse({ ...loaded.value, specials });
    return { ok: true };
  }

  async setArchived(courseId: string, archived: boolean): Promise<EditOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    await this.store.saveCourse({ ...loaded.value, archived });
    return { ok: true };
  }

  /** The files move to `.trash`; nothing is unlinked. */
  async deleteCourse(courseId: string): Promise<EditOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    await this.store.moveToTrash(courseId);
    return { ok: true };
  }

  async resetPickCounts(courseId: string): Promise<EditOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    await this.store.saveCourse(resetPickCounts(loaded.value));
    return { ok: true };
  }
}
