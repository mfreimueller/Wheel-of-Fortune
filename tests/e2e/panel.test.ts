import { expect, test } from '@playwright/test';
import { importFixture, open, readCourse, students } from './helpers';

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('color and count are editable and persisted; counters can be reset', async ({ page }) => {
  await importFixture(page);
  const [anna] = await students(page);

  await page.getByTestId(`color-${anna!.id}`).fill('#112233');
  await expect.poll(async () => (await students(page))[0]!.color).toBe('#112233');

  await page.getByTestId(`count-${anna!.id}`).fill('5');
  await page.getByTestId(`count-${anna!.id}`).blur();
  await expect.poll(async () => (await students(page))[0]!.pickCount).toBe(5);

  await page.getByTestId('reset-counts').click();
  await page.getByTestId('reset-confirm').click();
  await expect.poll(async () => (await students(page)).map((s) => s.pickCount)).toEqual([0, 0, 0]);
});

test('a weight set in the stored data is honoured by the draw but never shown in the UI', async ({ page }) => {
  await importFixture(page);
  await expect(page.getByText('Gewicht')).toHaveCount(0);

  // Only the third student keeps a weight above zero.
  const course = await readCourse(page);
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('wof:db')!);
    db.courses[0].students[0].weight = 0;
    db.courses[0].students[1].weight = 0;
    localStorage.setItem('wof:db', JSON.stringify(db));
  });
  await page.reload();
  await expect(page.getByTestId('students')).toBeVisible();
  await expect(page.getByText('Gewicht')).toHaveCount(0);
  await expect(page.getByText(/×\d/)).toHaveCount(0);

  await page.getByTestId('fair-toggle').uncheck();
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('wheel').click();
    await expect(page.getByTestId('result-name')).toContainText(course.students[2]!.firstName);
    await page.getByTestId('result-close').click();
  }
});

test('absent students never come up on the wheel', async ({ page }) => {
  await importFixture(page);
  const all = await students(page);
  const present = all[0]!;
  for (const s of all.slice(1)) await page.getByTestId(`absent-${s.id}`).check();

  for (let i = 0; i < 3; i++) {
    await page.getByTestId('wheel').click();
    await expect(page.getByTestId('result-name')).toContainText(present.firstName);
    await page.getByTestId('result-close').click();
  }
  await expect.poll(async () => (await students(page)).map((s) => s.pickCount)).toEqual([3, 0, 0]);
});

test('students missing from a newer roster become inactive and can be reactivated', async ({ page }) => {
  await importFixture(page);
  await importFixture(page, 'grader-roster-smaller.csv');

  await expect(page.locator('[data-student]')).toHaveCount(2);
  await page.getByTestId('inactive').locator('summary').click();
  const gone = (await students(page)).find((s) => !s.active)!;
  expect(gone.firstName).toBe('Rubi');
  await page.getByTestId(`reactivate-${gone.id}`).click();
  await expect(page.locator('[data-student]')).toHaveCount(3);
  await expect.poll(async () => (await students(page)).every((s) => s.active)).toBe(true);
});
