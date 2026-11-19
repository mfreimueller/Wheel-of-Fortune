import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/);

export const studentSchema = z.object({
  id: z.string().min(1),
  graderId: z.string().min(1).nullable().default(null),
  firstName: z.string(),
  lastName: z.string(),
  color: hexColor.nullable().default(null),
  pickCount: z.number().int().min(0).default(0),
  weight: z.number().min(0).default(1),
  active: z.boolean().default(true),
});

export const specialSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: hexColor,
  kind: z.enum(['spin-again', 'message']),
  message: z.string().optional(),
  probability: z.number().min(0).max(100),
  showIn: z.enum(['always', 'free-only']).default('always'),
});

export const courseFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1),
  /** Display form, e.g. "2026/27". */
  schoolYear: z.string().min(1),
  className: z.string().min(1),
  subject: z.string().min(1),
  archived: z.boolean().default(false),
  categories: z.array(z.string().min(1)).default([]),
  defaultCategory: z.string().min(1).default('Mitarbeit'),
  students: z.array(studentSchema).default([]),
  specials: z.array(specialSchema).default([]),
});

/** The whole persisted database: one document holding every course. */
export const dbSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  courses: z.array(courseFileSchema),
});

export type CourseFile = z.infer<typeof courseFileSchema>;
export type Db = z.infer<typeof dbSchema>;
