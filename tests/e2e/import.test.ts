import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const fixture = resolve('tests/fixtures/grader-roster.csv');
let dataDir: string;
let app: ElectronApplication;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
  app = await electron.launch({ args: ['.', `--user-data-dir=${dataDir}.user`], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  // Native file dialogs cannot be driven by Playwright; answer them from the main process.
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, fixture);
});

test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
  await rm(`${dataDir}.user`, { recursive: true, force: true });
});

test('importing a Grader CSV creates a course; importing it again changes nothing', async () => {
  const page = await app.firstWindow();
  await expect(page.getByTestId('empty')).toBeVisible();

  await page.getByTestId('import-button').click();
  const report = page.getByTestId('import-report');
  await expect(report).toContainText('Neuer Kurs angelegt.');
  await expect(report).toContainText('Neu hinzugefügt: 3');
  await page.getByRole('button', { name: 'Schließen' }).click();

  await expect(page.getByTestId('course-title')).toHaveText('3EHIF · DBIx - Modellierung');
  await expect(page.locator('[data-student]')).toHaveCount(3);
  await expect(page.getByTestId('year-select')).toHaveValue('2026/27');

  await page.getByTestId('import-button').click();
  await expect(page.getByTestId('import-report')).toContainText('Bestehender Kurs aktualisiert.');
  await expect(page.getByTestId('import-report')).toContainText('Neu hinzugefügt: 0');
  await expect(page.getByTestId('import-report')).toContainText('Aktualisiert: 0');
});

test('a CSV without school year asks for it', async () => {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, resolve('tests/fixtures/grader-roster-legacy.csv'));
  const page = await app.firstWindow();

  await page.getByTestId('import-button').click();
  await page.getByTestId('school-year-input').fill('2025/26');
  await page.getByTestId('school-year-confirm').click();
  await expect(page.getByTestId('import-report')).toContainText('Neuer Kurs angelegt.');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2025/26');
});
