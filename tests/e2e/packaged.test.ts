import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Runs against the real packaged app: WHEEL_APP=release/mac-arm64/"Wheel of Fortune.app"/Contents/MacOS/"Wheel of Fortune"
const executable = process.env['WHEEL_APP'];
test.skip(!executable, 'set WHEEL_APP to the packaged executable to run this test');

test('the packaged app imports a roster, spins and persists', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'wheel-packaged-'));
  const app = await electron.launch({ executablePath: executable!, env: { ...process.env, WHEEL_DATA_DIR: dataDir } });
  try {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, resolve('tests/fixtures/grader-roster.csv'));
    const page = await app.firstWindow();
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.getByTestId('import-button').click();
    await expect(page.getByTestId('import-report')).toContainText('Neuer Kurs angelegt.');
    await page.getByRole('button', { name: 'Schließen' }).click();
    await page.getByTestId('wheel').click();
    await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
