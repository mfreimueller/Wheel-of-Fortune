import { expect, test } from '@playwright/test';
import { importFixture, open, specials } from './helpers';

test('specials are saved, validated, and only free-only ones disappear in fair mode', async ({ page }) => {
  await open(page);
  await importFixture(page);
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

  await expect.poll(() => specials(page)).toMatchObject([
    { label: 'Nochmal drehen', kind: 'spin-again', probability: 10, showIn: 'free-only' },
    { label: 'Test!', kind: 'message', probability: 5, showIn: 'always' },
  ]);

  // Fair mode (default): only the "always" special is on the wheel (3 students + 1 special).
  await expect(page.locator('[data-segment]')).toHaveCount(4);
  await page.getByTestId('fair-toggle').uncheck();
  await expect(page.locator('[data-segment]')).toHaveCount(5);
});

test('landing on a message special shows its dialog and counts nobody', async ({ page }) => {
  await open(page);
  await importFixture(page);
  await page.getByTestId('edit-specials').click();
  await page.getByTestId('special-add').click();
  await page.getByTestId('special-label-0').fill('Blatt raus!');
  await page.getByTestId('special-kind-0').selectOption('message');
  await page.getByTestId('special-prob-0').fill('99.9');
  await page.getByTestId('specials-save').click();
  await expect(page.locator('[data-segment]')).toHaveCount(4);

  await page.getByTestId('wheel').click();
  await expect(page.getByTestId('special-label')).toHaveText('Blatt raus!');
  await page.getByRole('button', { name: 'Schließen' }).click();
  const counts = await page.locator('[data-student] input.count').evaluateAll((els) => els.map((e) => Number((e as HTMLInputElement).value)));
  expect(counts).toEqual([0, 0, 0]);
});
