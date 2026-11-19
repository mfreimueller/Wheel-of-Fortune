import type { Result } from '../core/result';
import type { CourseFile } from '../core/schemas';
import type { CourseListing, ReadError } from '../shared/types';

/** Where courses live. The services only know this interface, never the storage behind it. */
export interface CourseRepo {
  listCourses(): Promise<CourseListing>;
  loadCourse(id: string): Promise<Result<CourseFile, ReadError>>;
  saveCourse(course: CourseFile): Promise<void>;
  deleteCourse(id: string): Promise<void>;
}
