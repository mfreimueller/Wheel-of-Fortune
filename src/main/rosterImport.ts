import { parseRosterCsv } from '../core/rosterCsv';
import { mergeRoster } from '../core/rosterMerge';
import { currentSchoolYear, normalizeSchoolYear } from '../core/schoolYear';
import type { ImportOutcome } from '../shared/types';
import type { CourseStore } from './store/courseStore';

export class RosterImportService {
  constructor(
    private readonly store: CourseStore,
    private readonly newId: (prefix: string) => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** `schoolYear` is only used when the CSV itself has no `Schuljahr` column. */
  async importCsv(input: { text: string; schoolYear?: string }): Promise<ImportOutcome> {
    const parsed = parseRosterCsv(input.text);
    if (!parsed.ok) return { status: 'error', error: parsed.error };

    const schoolYear = parsed.value.schoolYear ?? (input.schoolYear ? normalizeSchoolYear(input.schoolYear) : null);
    if (!schoolYear) return { status: 'needs-school-year', suggested: currentSchoolYear(this.now()) };

    const { courses } = await this.store.listCourses();
    const match = courses.find((c) => c.schoolYear === schoolYear && c.className === parsed.value.className && c.subject === parsed.value.subject);

    let existing = null;
    if (match) {
      const loaded = await this.store.loadCourse(match.id);
      if (!loaded.ok) return { status: 'error', error: { code: 'unreadable-course', detail: loaded.error.message } };
      existing = loaded.value;
    }

    const { course, report } = mergeRoster(existing, { ...parsed.value, schoolYear }, this.newId);
    await this.store.saveCourse(course);
    return { status: 'imported', courseId: course.id, report };
  }
}
