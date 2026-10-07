import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const fixture = resolve('tests/fixtures/grader-roster.csv');
let dataDir: string;
let app: ElectronApplication;

async function launch(): Promise<Page> {
  app = await electron.launch({ args: ['.'], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, fixture);
  const page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' }); // the 6 s spin resolves immediately
  return page;
}

async function counts(page: Page): Promise<number[]> {
  const texts = await page.getByTestId('count').allTextContents();
  return texts.map(Number);
}

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
});
test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
});

test('fair mode picks every student once before anybody is picked twice; counts survive a restart', async () => {
  let page = await launch();
  await page.getByTestId('import-button').click();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByTestId('students')).toBeVisible();
  expect(await counts(page)).toEqual([0, 0, 0]);

  for (let i = 1; i <= 3; i++) {
    await page.getByTestId('wheel').click();
    await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
    await page.getByTestId('result-close').click();
    expect((await counts(page)).reduce((a, b) => a + b, 0)).toBe(i);
  }
  expect(await counts(page)).toEqual([1, 1, 1]);

  await page.getByTestId('wheel').click();
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 2');
  await page.getByTestId('result-close').click();

  await app.close();
  page = await launch();
  await expect(page.getByTestId('students')).toBeVisible();
  expect((await counts(page)).reduce((a, b) => a + b, 0)).toBe(4);
});

test('a direct pick counts without spinning, and free mode can pick the same student again', async () => {
  const page = await launch();
  await page.getByTestId('import-button').click();
  await page.getByRole('button', { name: 'Schließen' }).click();

  const first = page.locator('[data-student]').first();
  const id = await first.getAttribute('data-student');
  await page.getByTestId(`pick-${id}`).click();
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
  await page.getByTestId('result-close').click();
  await page.getByTestId(`pick-${id}`).click();
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 2');
});
