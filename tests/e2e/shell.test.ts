import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dataDir: string;
let app: ElectronApplication;

async function setUp(): Promise<Page> {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
  app = await electron.launch({ args: ['.'], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, resolve('tests/fixtures/grader-roster.csv'));
  const page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('import-button').click();
  await page.getByRole('button', { name: 'Schließen' }).click();
  return page;
}

test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
});

test('presentation mode hides everything but the wheel; P and Esc toggle it', async () => {
  const page = await setUp();
  await expect(page.getByTestId('students')).toBeVisible();

  await page.getByTestId('present').click();
  await expect(page.getByTestId('students')).toHaveCount(0);
  await expect(page.getByTestId('year-select')).toHaveCount(0);
  await expect(page.getByTestId('wheel')).toBeVisible();

  await page.getByTestId('wheel').click(); // the wheel still works
  await expect(page.getByTestId('result-name')).toBeVisible();
  await page.getByTestId('result-close').click();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('students')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByTestId('students')).toHaveCount(0);
  await page.getByTestId('exit-presentation').click();
  await expect(page.getByTestId('students')).toBeVisible();
});

test('typing a p into a field does not toggle the presentation mode', async () => {
  const page = await setUp();
  const id = await page.locator('[data-student]').first().getAttribute('data-student');
  await page.getByTestId(`count-${id}`).focus();
  await page.keyboard.press('p');
  await expect(page.getByTestId('students')).toBeVisible();
});

test('a course can be archived, shown again and deleted into the trash', async () => {
  const page = await setUp();

  await page.getByTestId('course-menu').locator('summary').click();
  await page.getByTestId('archive-course').click();
  await expect(page.getByTestId('empty')).toBeVisible();

  await page.getByTestId('show-archived').check();
  await expect(page.getByTestId('course-select')).toContainText('archiviert');
  await expect(page.getByTestId('students')).toBeVisible();

  await page.getByTestId('course-menu').locator('summary').click();
  await page.getByTestId('delete-course').click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('students')).toHaveCount(0);

  const trash = await readdir(join(dataDir, '.trash', '2026-27'));
  expect(trash.some((f) => f.endsWith('.course.json'))).toBe(true);
  await expect(access(join(dataDir, '2026-27'))).resolves.toBeUndefined();
  expect((await readdir(join(dataDir, '2026-27'))).filter((f) => f.endsWith('.course.json'))).toEqual([]);
});

test('settings show the data folder and lock it when it comes from the environment', async () => {
  const page = await setUp();
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('data-dir')).toHaveText(dataDir);
  await expect(page.getByTestId('data-dir-locked')).toBeVisible();
  await expect(page.getByTestId('choose-data-dir')).toBeDisabled();
});
