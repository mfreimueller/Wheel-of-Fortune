import { expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export const fixturePath = (name: string): string => resolve('tests/fixtures', name);

/** Each Playwright test gets a fresh browser context, so localStorage starts empty. */
export async function open(page: Page): Promise<void> {
  await page.goto('/');
}

/** Clicks "CSV importieren", answers the browser's file chooser and closes the report. */
export async function importFixture(page: Page, name = 'grader-roster.csv'): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-button').click();
  await (await chooser).setFiles(fixturePath(name));
  await expect(page.getByTestId('import-report')).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
}

export interface StoredStudent {
  id: string;
  color: string | null;
  pickCount: number;
  weight: number;
  active: boolean;
  firstName: string;
}

export interface StoredCourse {
  id: string;
  students: StoredStudent[];
  specials: { id: string; label: string; kind: string; probability: number; showIn: string; message?: string }[];
}

export async function readCourse(page: Page): Promise<StoredCourse> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('wof:db') ?? '{"courses":[{}]}').courses[0]);
}

export const students = async (page: Page): Promise<StoredStudent[]> => (await readCourse(page)).students;
export const specials = async (page: Page): Promise<StoredCourse['specials']> => (await readCourse(page)).specials;
