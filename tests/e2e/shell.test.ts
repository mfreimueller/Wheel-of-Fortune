import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFixture, open, students } from './helpers';

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('a course can be archived, shown again and deleted', async ({ page }) => {
  await importFixture(page);

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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wof:db')!).courses)).toEqual([]);
});

test('settings show the last backup; a backup can be exported and restored', async ({ page }, testInfo) => {
  await importFixture(page);
  const [anna] = await students(page);
  await page.getByTestId(`count-${anna!.id}`).fill('7');
  await page.getByTestId(`count-${anna!.id}`).blur();
  await expect.poll(async () => (await students(page))[0]!.pickCount).toBe(7);

  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('last-backup')).toContainText('Noch kein Backup');

  const download = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^wheel-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = join(tmpdir(), `${testInfo.testId}-${file.suggestedFilename()}`);
  await file.saveAs(path);
  expect(JSON.parse(await readFile(path, 'utf-8')).courses).toHaveLength(1);
  await expect(page.getByTestId('last-backup')).toContainText('Letztes Backup:');

  // Change the data, then restore the backup over it (after confirming).
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByTestId('course-menu').locator('summary').click();
  await page.getByTestId('delete-course').click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('empty')).toBeVisible();

  await page.getByTestId('settings-button').click();
  await page.getByTestId('backup-import').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('backup-import-confirm').click();
  await (await chooser).setFiles(path);
  await expect(page.getByTestId('backup-message')).toContainText('1 Kurse');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByTestId('students')).toBeVisible();
  expect((await students(page))[0]!.pickCount).toBe(7);
});

test('an invalid backup file is rejected and keeps the data', async ({ page }, testInfo) => {
  await importFixture(page);
  const path = join(tmpdir(), `${testInfo.testId}-bad.json`);
  await writeFile(path, '{"hello": 1}');

  await page.getByTestId('settings-button').click();
  await page.getByTestId('backup-import').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('backup-import-confirm').click();
  await (await chooser).setFiles(path);
  await expect(page.getByTestId('backup-message')).toContainText('keine gültige Backup-Datei');
  expect(await students(page)).toHaveLength(3);
});

test('corrupt stored data shows a recovery option instead of a blank page', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('wof:db', '{ nope'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('nicht gelesen werden');
  const download = page.waitForEvent('download');
  await page.getByTestId('download-raw').click();
  expect((await download).suggestedFilename()).toBe('wheel-raw-data.json');

  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('reset-store').click();
  await expect(page.getByTestId('empty')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wof:db'))).toBeNull();
});

test('blocked browser storage shows a message instead of a broken app', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('no-storage')).toContainText('keine lokale Speicherung');
});

test('a failing save shows an error banner', async ({ page }) => {
  await importFixture(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
  await page.getByTestId('wheel').click();
  await expect(page.getByTestId('app-error')).toContainText('Speichern fehlgeschlagen');
});

test('the help dialog explains the CSV import and can be closed', async ({ page }) => {
  await page.getByTestId('help-button').click();
  const dialog = page.getByTestId('help-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('help-import-title')).toHaveText('Klassenliste importieren');
  await expect(dialog).toContainText('Klasse, Fach, Vorname, Nachname');
  await expect(dialog).toContainText('Daten & Backup');
  await page.getByTestId('help-close').click();
  await expect(dialog).toHaveCount(0);
});
