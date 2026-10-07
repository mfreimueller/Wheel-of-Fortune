import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dataDir: string;
let app: ElectronApplication;

const entries = async () => (await assessments()).days.flatMap((d) => d.entries);

async function assessments(): Promise<{ days: { date: string; entries: { symbol: string; category: string; studentId: string }[] }[] }> {
  const yearDir = join(dataDir, '2026-27');
  const file = (await readdir(yearDir)).find((f) => f.endsWith('.assessments.json'));
  if (!file) return { days: [] };
  return JSON.parse(await readFile(join(yearDir, file), 'utf-8'));
}

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
  app = await electron.launch({ args: ['.'], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, resolve('tests/fixtures/grader-roster.csv'));
});
test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
});

test('a picked student can be graded, re-graded, moved to another category and un-graded', async () => {
  const page = await app.firstWindow();
  await page.getByTestId('import-button').click();
  await page.getByRole('button', { name: 'Schließen' }).click();

  const id = await page.locator('[data-student]').first().getAttribute('data-student');
  await page.getByTestId(`pick-${id}`).click();

  await expect(page.getByTestId('grade-category')).toHaveValue('Mitarbeit');
  await page.getByTestId('grade-PLUS').click();
  await expect(page.getByTestId('grade-saved')).toBeVisible();
  await expect.poll(entries).toMatchObject([{ symbol: 'PLUS', category: 'Mitarbeit', studentId: id }]);

  await page.getByTestId('grade-MINUS').click();
  await expect.poll(entries).toMatchObject([{ symbol: 'MINUS' }]);

  await page.getByTestId('grade-category').selectOption('Wiederholung');
  await expect.poll(entries).toMatchObject([{ symbol: 'MINUS', category: 'Wiederholung' }]);

  await page.getByTestId('grade-MINUS').click(); // active symbol again = undo
  await expect(page.getByTestId('grade-MINUS')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(entries).toEqual([]);
});
