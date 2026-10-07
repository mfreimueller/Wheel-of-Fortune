import { draw } from '../core/draw';
import type { CourseFile } from '../core/schemas';
import type { PickedStudent, PickOutcome } from '../shared/types';
import type { CourseStore } from './store/courseStore';

export interface DrawOptions {
  fair: boolean;
  /** Students that are absent today; session state of the renderer. */
  absentIds: readonly string[];
}

/** Draws students, counts the pick and persists it immediately (before the wheel has finished spinning). */
export class PickService {
  constructor(
    private readonly store: CourseStore,
    private readonly random: () => number = Math.random,
  ) {}

  async draw(courseId: string, options: DrawOptions): Promise<PickOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    const course = loaded.value;

    const outcome = draw({
      students: course.students,
      specials: course.specials,
      fair: options.fair,
      absentIds: new Set(options.absentIds),
      random: this.random,
    });
    if (!outcome.ok) return outcome;

    const last = outcome.spins.at(-1);
    if (last?.kind !== 'student') return { ok: true, spins: outcome.spins, picked: null };
    return { ok: true, spins: outcome.spins, picked: await this.count(course, last.studentId) };
  }

  /** Direct pick without a spin ("Aufrufen"). */
  async pickStudent(courseId: string, studentId: string): Promise<PickOutcome> {
    const loaded = await this.store.loadCourse(courseId);
    if (!loaded.ok) return { ok: false, error: 'course-unreadable' };
    if (!loaded.value.students.some((s) => s.id === studentId && s.active)) return { ok: false, error: 'unknown-student' };
    return { ok: true, spins: [{ kind: 'student', studentId }], picked: await this.count(loaded.value, studentId) };
  }

  private async count(course: CourseFile, studentId: string): Promise<PickedStudent> {
    const student = course.students.find((s) => s.id === studentId)!;
    student.pickCount += 1;
    await this.store.saveCourse(course);
    return {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      color: student.color,
      pickCount: student.pickCount,
    };
  }
}
