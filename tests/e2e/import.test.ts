import { expect, test } from '@playwright/test';
import { fixturePath, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('importing a roster CSV creates a course; importing it again changes nothing', async ({ page }) => {
  await expect(page.getByTestId('empty')).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-button').click();
  await (await chooser).setFiles(fixturePath('grader-roster.csv'));
  const report = page.getByTestId('import-report');
  await expect(report).toContainText('Neuer Kurs angelegt.');
  await expect(report).toContainText('Neu hinzugefügt: 3');
  await page.getByRole('button', { name: 'Schließen' }).click();

  await expect(page.getByTestId('course-title')).toHaveText('3EHIF · DBIx - Modellierung');
  await expect(page.locator('[data-student]')).toHaveCount(3);
  await expect(page.getByTestId('year-select')).toHaveValue('2026/27');

  const again = page.waitForEvent('filechooser');
  await page.getByTestId('import-button').click();
  await (await again).setFiles(fixturePath('grader-roster.csv'));
  await expect(page.getByTestId('import-report')).toContainText('Bestehender Kurs aktualisiert.');
  await expect(page.getByTestId('import-report')).toContainText('Neu hinzugefügt: 0');
  await expect(page.getByTestId('import-report')).toContainText('Aktualisiert: 0');
});

test('a CSV without school year asks for it', async ({ page }) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-button').click();
  await (await chooser).setFiles(fixturePath('grader-roster-legacy.csv'));
  await page.getByTestId('school-year-input').fill('2025/26');
  await page.getByTestId('school-year-confirm').click();
  await expect(page.getByTestId('import-report')).toContainText('Neuer Kurs angelegt.');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2025/26');
});
