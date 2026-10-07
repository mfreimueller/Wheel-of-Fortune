import { normalizeColor } from './color';
import type { CourseFile } from './schemas';

export interface StudentPatch {
  /** `null` clears the own color (the wheel palette is used again). */
  color?: string | null;
  pickCount?: number;
  active?: boolean;
}

export type PatchError = 'unknown-student' | 'invalid-color' | 'invalid-pick-count';

export type PatchResult = { ok: true; course: CourseFile } | { ok: false; error: PatchError };

/** Returns a copy of the course with the patch applied; the input is never mutated. */
export function applyStudentPatch(course: CourseFile, studentId: string, patch: StudentPatch): PatchResult {
  const index = course.students.findIndex((s) => s.id === studentId);
  if (index < 0) return { ok: false, error: 'unknown-student' };

  const next = { ...course.students[index]! };
  if (patch.color !== undefined) {
    const color = patch.color === null ? null : normalizeColor(patch.color);
    if (patch.color !== null && !color) return { ok: false, error: 'invalid-color' };
    next.color = color;
  }
  if (patch.pickCount !== undefined) {
    if (!Number.isInteger(patch.pickCount) || patch.pickCount < 0) return { ok: false, error: 'invalid-pick-count' };
    next.pickCount = patch.pickCount;
  }
  if (patch.active !== undefined) next.active = patch.active;

  const students = [...course.students];
  students[index] = next;
  return { ok: true, course: { ...course, students } };
}

export function resetPickCounts(course: CourseFile): CourseFile {
  return { ...course, students: course.students.map((s) => ({ ...s, pickCount: 0 })) };
}
