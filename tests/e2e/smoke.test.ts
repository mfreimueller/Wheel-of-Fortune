import { _electron as electron, expect, test } from '@playwright/test';

test('app starts and shows the title', async () => {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();
  await expect(page.getByTestId('title')).toHaveText('Glücksrad');
  await app.close();
});
