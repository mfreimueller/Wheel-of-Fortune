import { expect, test, type Page } from '@playwright/test';
import { importFixture, open } from './helpers';

async function counts(page: Page): Promise<number[]> {
  return page.locator('[data-student] input.count').evaluateAll((inputs) => inputs.map((i) => Number((i as HTMLInputElement).value)));
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('fair mode picks every student once before anybody is picked twice; counts survive a reload', async ({ page }) => {
  await importFixture(page);
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

  await page.reload();
  await expect(page.getByTestId('students')).toBeVisible();
  expect((await counts(page)).reduce((a, b) => a + b, 0)).toBe(4);
});

test('a direct pick counts without spinning, and free mode can pick the same student again', async ({ page }) => {
  await importFixture(page);

  const first = page.locator('[data-student]').first();
  const id = await first.getAttribute('data-student');
  await page.getByTestId(`pick-${id}`).click();
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
  await page.getByTestId('result-close').click();
  await page.getByTestId(`pick-${id}`).click();
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 2');
});
