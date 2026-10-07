import type { CourseFile } from './schemas';

export type Student = CourseFile['students'][number];
export type Special = CourseFile['specials'][number];
export type SpecialKind = Special['kind'];
export type SpecialVisibility = Special['showIn'];
