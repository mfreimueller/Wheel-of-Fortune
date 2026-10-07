import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dataDir: string;
let outDir: string;
let app: ElectronApplication;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
  outDir = await mkdtemp(join(tmpdir(), 'wheel-out-'));
  app = await electron.launch({ args: ['.', `--user-data-dir=${dataDir}.user`], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  await app.evaluate(
    ({ dialog }, { file, out }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: out });
    },
    { file: resolve('tests/fixtures/grader-roster.csv'), out: join(outDir, 'aufrufe.csv') },
  );
});
test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
  await rm(`${dataDir}.user`, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('graded picks are exported in Grader format, and only new ones next time', async () => {
  const page = await app.firstWindow();
  await page.getByTestId('import-button').click();
  await page.getByRole('button', { name: 'Schließen' }).click();

  const id = await page.locator('[data-student]').first().getAttribute('data-student');
  await page.getByTestId(`pick-${id}`).click();
  await page.getByTestId('grade-PLUS').click();
  await expect(page.getByTestId('grade-saved')).toBeVisible();
  await page.getByTestId('result-close').click();

  // An ungraded pick must never show up in the export.
  const other = await page.locator('[data-student]').nth(1).getAttribute('data-student');
  await page.getByTestId(`pick-${other}`).click();
  await page.getByTestId('result-close').click();

  await page.getByTestId('export-button').click();
  await expect(page.getByText('Nur neue Einträge (1)')).toBeVisible();
  await page.getByTestId('export-confirm').click();
  await expect(page.getByTestId('export-report')).toContainText('1 Einträge exportiert.');

  const lines = (await readFile(join(outDir, 'aufrufe.csv'), 'utf-8')).trim().split('\n');
  expect(lines[0]).toBe('Nachname;Vorname;Kategorie;Name;Datum;Max;Note');
  expect(lines).toHaveLength(2);
  expect(lines[1]).toMatch(/^Bob;Anna;Mitarbeit;Aufruf \(Mitarbeit\);\d{2}\.\d{2}\.\d{4};;\+$/);
  await page.getByRole('button', { name: 'Schließen' }).click();

  await page.getByTestId('export-button').click();
  await expect(page.getByText('Nur neue Einträge (0)')).toBeVisible();
  await expect(page.getByTestId('scope-all')).toBeChecked();
});
