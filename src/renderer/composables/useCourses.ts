import { computed, ref, watch } from 'vue';
import type { CourseFile } from '../../core/schemas';
import type { CourseListing, CourseSummary, ReadError } from '../../shared/types';

const STORAGE_KEY = 'wheel.selection';

function remembered(): { year: string; courseId: string } {
  try {
    return { year: '', courseId: '', ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return { year: '', courseId: '' };
  }
}

/** Course listing, the selected school year/course and the loaded course file. */
export function useCourses() {
  const listing = ref<CourseListing>({ courses: [], problems: [] });
  const year = ref('');
  const courseId = ref('');
  const course = ref<CourseFile | null>(null);
  const loadError = ref<ReadError | null>(null);

  const years = computed(() => [...new Set(listing.value.courses.map((c) => c.schoolYear))].sort().reverse());
  const coursesInYear = computed<CourseSummary[]>(() =>
    listing.value.courses
      .filter((c) => c.schoolYear === year.value && !c.archived)
      .sort((a, b) => `${a.className} ${a.subject}`.localeCompare(`${b.className} ${b.subject}`, 'de')),
  );

  async function refresh(select?: { courseId: string }): Promise<void> {
    listing.value = await window.wheel.courses.list();
    if (select) {
      const target = listing.value.courses.find((c) => c.id === select.courseId);
      if (target) {
        year.value = target.schoolYear;
        courseId.value = target.id;
      }
    }
    if (!years.value.includes(year.value)) year.value = years.value[0] ?? '';
    if (!coursesInYear.value.some((c) => c.id === courseId.value)) courseId.value = coursesInYear.value[0]?.id ?? '';
    await loadSelected();
  }

  /** Re-reads the selected course without clearing it first, so the view keeps its state. */
  async function reload(): Promise<void> {
    if (!courseId.value) return;
    const loaded = await window.wheel.courses.load(courseId.value);
    if (loaded.ok) course.value = loaded.value;
    else loadError.value = loaded.error;
  }

  async function loadSelected(): Promise<void> {
    course.value = null;
    loadError.value = null;
    if (!courseId.value) return;
    const loaded = await window.wheel.courses.load(courseId.value);
    if (loaded.ok) course.value = loaded.value;
    else loadError.value = loaded.error;
  }

  watch(year, () => {
    if (!coursesInYear.value.some((c) => c.id === courseId.value)) courseId.value = coursesInYear.value[0]?.id ?? '';
  });
  watch(courseId, () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ year: year.value, courseId: courseId.value }));
    } catch {
      // Remembering the selection is a convenience only.
    }
    void loadSelected();
  });

  const saved = remembered();
  year.value = saved.year;
  courseId.value = saved.courseId;

  return { listing, years, year, coursesInYear, courseId, course, loadError, refresh, reload };
}
