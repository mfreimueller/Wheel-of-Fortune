import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
  app = await electron.launch({ args: ['.', `--user-data-dir=${dataDir}.user`], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
});
test.afterEach(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
  await rm(`${dataDir}.user`, { recursive: true, force: true });
});

test('color and count are editable and persisted; counters can be reset', async () => {
  const page = await app.firstWindow();
  await importFixture(page);
  const [anna] = await students();

  await page.getByTestId(`color-${anna!.id}`).fill('#112233');
  await expect.poll(async () => (await students())[0]!.color).toBe('#112233');

  await page.getByTestId(`count-${anna!.id}`).fill('5');
  await page.getByTestId(`count-${anna!.id}`).blur();
  await expect.poll(async () => (await students())[0]!.pickCount).toBe(5);

  await page.getByTestId('reset-counts').click();
  await page.getByTestId('reset-confirm').click();
  await expect.poll(async () => (await students()).map((s) => s.pickCount)).toEqual([0, 0, 0]);
});

test('a weight set in the JSON file is honoured by the draw but never shown in the UI', async () => {
  let page = await app.firstWindow();
  await importFixture(page);
  await expect(page.getByText('Gewicht')).toHaveCount(0);
  await app.close();

  // Only the third student keeps a weight above zero: hand-edit the course file like a teacher would.
  const yearDir = join(dataDir, '2026-27');
  const file = join(yearDir, (await readdir(yearDir)).find((f) => f.endsWith('.course.json'))!);
  const course = JSON.parse(await readFile(file, 'utf-8'));
  course.students[0].weight = 0;
  course.students[1].weight = 0;
  await writeFile(file, JSON.stringify(course, null, 2));

  app = await electron.launch({ args: ['.', `--user-data-dir=${dataDir}.user`], env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('students')).toBeVisible();
  await expect(page.getByText('Gewicht')).toHaveCount(0);
  await expect(page.getByText(/×\d/)).toHaveCount(0);

  await page.getByTestId('fair-toggle').uncheck();
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('wheel').click();
    await expect(page.getByTestId('result-name')).toContainText(course.students[2].firstName);
    await page.getByTestId('result-close').click();
  }
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
