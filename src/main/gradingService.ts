import { applyGrade, localDate, type GradeSymbol } from '../core/assessments';
import type { CourseStore } from './store/courseStore';

export interface SetGradeInput {
  courseId: string;
  studentId: string;
  category: string;
  symbol: GradeSymbol | null;
  /** The entry created earlier by the same dialog, if any. */
  replaces?: string | null;
}

export type SetGradeOutcome =
  | { ok: true; entryId: string | null }
  | { ok: false; error: 'unknown-student' | 'course-unreadable' | 'assessments-unreadable' };

/** Records, replaces and removes the graded picks of a course. */
export class GradingService {
  constructor(
    private readonly store: CourseStore,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: (prefix: string) => string = (prefix) => `${prefix}_${crypto.randomUUID()}`,
  ) {}

  async set(input: SetGradeInput): Promise<SetGradeOutcome> {
    const course = await this.store.loadCourse(input.courseId);
    if (!course.ok) return { ok: false, error: 'course-unreadable' };
    if (!course.value.students.some((s) => s.id === input.studentId)) return { ok: false, error: 'unknown-student' };

    const assessments = await this.store.loadAssessments(input.courseId);
    if (!assessments.ok) return { ok: false, error: 'assessments-unreadable' };

    const now = this.now();
    const { file, entryId } = applyGrade(assessments.value, {
      date: localDate(now),
      studentId: input.studentId,
      category: input.category,
      symbol: input.symbol,
      replaces: input.replaces ?? null,
      now,
      newId: this.newId,
    });
    await this.store.saveAssessments(file);
    return { ok: true, entryId };
  }
}
