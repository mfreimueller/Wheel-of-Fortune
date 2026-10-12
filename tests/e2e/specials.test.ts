import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dataDir: string;
let app: ElectronApplication;

async function specials(): Promise<{ id: string; label: string; kind: string; probability: number; showIn: string; message?: string }[]> {
  const yearDir = join(dataDir, '2026-27');
  const file = (await readdir(yearDir)).find((f) => f.endsWith('.course.json'))!;
  return JSON.parse(await readFile(join(yearDir, file), 'utf-8')).specials;
}

async function setUp(): Promise<Page> {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
  app = await electron.launch({ args: ['.', `--user-data-dir=${dataDir}.user`], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
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
  await rm(`${dataDir}.user`, { recursive: true, force: true });
});

test('specials are saved, validated, and only free-only ones disappear in fair mode', async () => {
  const page = await setUp();
  await page.getByTestId('edit-specials').click();
  await page.getByTestId('special-add').click();
  await page.getByTestId('special-label-0').fill('Nochmal drehen');
  await page.getByTestId('special-prob-0').fill('120');
  await expect(page.getByTestId('specials-error')).toBeVisible();
  await expect(page.getByTestId('specials-save')).toBeDisabled();

  await page.getByTestId('special-prob-0').fill('10');
  await page.getByTestId('special-showin-0').selectOption('free-only');
  await page.getByTestId('special-add').click();
  await page.getByTestId('special-label-1').fill('Test!');
  await page.getByTestId('special-kind-1').selectOption('message');
  await page.getByTestId('special-prob-1').fill('5');
  await expect(page.getByTestId('specials-share')).toContainText('85.0');
  await page.getByTestId('specials-save').click();

  await expect.poll(specials).toMatchObject([
    { label: 'Nochmal drehen', kind: 'spin-again', probability: 10, showIn: 'free-only' },
    { label: 'Test!', kind: 'message', probability: 5, showIn: 'always' },
  ]);

  // Fair mode (default): only the "always" special is on the machine (3 students + 1 special).
  await expect(page.getByTestId('wheel-machine')).toHaveAttribute('data-item-count', '4');
  await page.getByTestId('fair-toggle').uncheck();
  await expect(page.getByTestId('wheel-machine')).toHaveAttribute('data-item-count', '5');
});

test('landing on a message special shows its dialog and counts nobody', async () => {
  const page = await setUp();
  await page.getByTestId('edit-specials').click();
  await page.getByTestId('special-add').click();
  await page.getByTestId('special-label-0').fill('Blatt raus!');
  await page.getByTestId('special-kind-0').selectOption('message');
  await page.getByTestId('special-prob-0').fill('99.9');
  await page.getByTestId('specials-save').click();
  await expect(page.getByTestId('wheel-machine')).toHaveAttribute('data-item-count', '4');

  await page.getByTestId('wheel').click();
  await expect(page.getByTestId('special-label')).toHaveText('Blatt raus!');
  await page.getByRole('button', { name: 'Schließen' }).click();
  const counts = await page.locator('[data-student] input.count').evaluateAll((els) => els.map((e) => Number((e as HTMLInputElement).value)));
  expect(counts).toEqual([0, 0, 0]);
});
