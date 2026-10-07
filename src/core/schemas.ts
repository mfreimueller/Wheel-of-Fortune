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

export const assessmentEntrySchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  category: z.string().min(1),
  symbol: z.enum(['PLUS', 'WELLE', 'MINUS']),
  gradedAt: z.string(),
  exportedAt: z.string().nullable().default(null),
});

export const assessmentsFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  courseId: z.string().min(1),
  days: z
    .array(
      z.object({
        /** ISO date, e.g. "2026-10-07". */
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        entries: z.array(assessmentEntrySchema),
      }),
    )
    .default([]),
});

export type CourseFile = z.infer<typeof courseFileSchema>;
export type AssessmentsFile = z.infer<typeof assessmentsFileSchema>;
export type AssessmentEntry = z.infer<typeof assessmentEntrySchema>;
