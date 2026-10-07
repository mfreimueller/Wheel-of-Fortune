import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dataDir: string;
let app: ElectronApplication;

async function students(): Promise<{ id: string; color: string | null; pickCount: number; weight: number; active: boolean; firstName: string }[]> {
  const yearDir = join(dataDir, '2026-27');
  const file = (await readdir(yearDir)).find((f) => f.endsWith('.course.json'))!;
  return JSON.parse(await readFile(join(yearDir, file), 'utf-8')).students;
}

async function chooseFile(name: string): Promise<void> {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, resolve(`tests/fixtures/${name}`));
}

async function importFixture(page: Page, name = 'grader-roster.csv'): Promise<void> {
  await chooseFile(name);
  await page.getByTestId('import-button').click();
  await page.getByRole('button', { name: 'Schließen' }).click();
}

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'wheel-e2e-'));
  app = await electron.launch({ args: ['.'], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
});
test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
});

test('color, count and weight are editable and persisted; counters can be reset', async () => {
  const page = await app.firstWindow();
  await importFixture(page);
  const [anna] = await students();

  await page.getByTestId(`color-${anna!.id}`).fill('#112233');
  await expect.poll(async () => (await students())[0]!.color).toBe('#112233');

  await page.getByTestId(`weight-${anna!.id}-3`).click();
  await expect.poll(async () => (await students())[0]!.weight).toBe(3);
  await expect(page.getByTestId(`weight-${anna!.id}-3`)).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId(`count-${anna!.id}`).fill('5');
  await page.getByTestId(`count-${anna!.id}`).blur();
  await expect.poll(async () => (await students())[0]!.pickCount).toBe(5);

  await page.getByTestId('reset-counts').click();
  await page.getByTestId('reset-confirm').click();
  await expect.poll(async () => (await students()).map((s) => s.pickCount)).toEqual([0, 0, 0]);
});

test('absent students never come up on the wheel', async () => {
  const page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await importFixture(page);
  const all = await students();
  const present = all[0]!;
  for (const s of all.slice(1)) await page.getByTestId(`absent-${s.id}`).check();

  for (let i = 0; i < 3; i++) {
    await page.getByTestId('wheel').click();
    await expect(page.getByTestId('result-name')).toContainText(present.firstName);
    await page.getByTestId('result-close').click();
  }
  await expect.poll(async () => (await students()).map((s) => s.pickCount)).toEqual([3, 0, 0]);
});

test('students missing from a newer export become inactive and can be reactivated', async () => {
  const page = await app.firstWindow();
  await importFixture(page);
  await importFixture(page, 'grader-roster-smaller.csv');

  await expect(page.locator('[data-student]')).toHaveCount(2);
  await page.getByTestId('inactive').locator('summary').click();
  const gone = (await students()).find((s) => !s.active)!;
  expect(gone.firstName).toBe('Rubi');
  await page.getByTestId(`reactivate-${gone.id}`).click();
  await expect(page.locator('[data-student]')).toHaveCount(3);
  await expect.poll(async () => (await students()).every((s) => s.active)).toBe(true);
});
