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

  async resetPickCounts(courseId: string): Promise<EditOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    await this.store.saveCourse(resetPickCounts(loaded.value));
    return { ok: true };
  }
}
