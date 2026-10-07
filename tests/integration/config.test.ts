import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig, resolveDataDir, writeConfig } from '../../src/main/config';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-config-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('config', () => {
  it('is empty when no config file exists', async () => {
    expect(await readConfig(dir)).toEqual({});
  });

  it('round-trips the data directory', async () => {
    await writeConfig(dir, { dataDir: '/data/wheel' });
    expect(await readConfig(dir)).toEqual({ dataDir: '/data/wheel' });
    expect(JSON.parse(await readFile(join(dir, 'config.json'), 'utf-8'))).toMatchObject({ dataDir: '/data/wheel' });
  });

  it('falls back to defaults for a broken or invalid config file instead of crashing', async () => {
    await writeFile(join(dir, 'config.json'), '{ nope');
    expect(await readConfig(dir)).toEqual({});
    await writeFile(join(dir, 'config.json'), JSON.stringify({ dataDir: 5 }));
    expect(await readConfig(dir)).toEqual({});
  });
});

describe('resolveDataDir', () => {
  it('prefers the environment, then the config, then the default inside userData', () => {
    expect(resolveDataDir({ env: '/env', config: { dataDir: '/cfg' }, userData: '/user' })).toEqual({ dataDir: '/env', source: 'env' });
    expect(resolveDataDir({ env: undefined, config: { dataDir: '/cfg' }, userData: '/user' })).toEqual({ dataDir: '/cfg', source: 'config' });
    expect(resolveDataDir({ env: undefined, config: {}, userData: '/user' })).toEqual({ dataDir: join('/user', 'data'), source: 'default' });
  });

  it('ignores an empty environment value', () => {
    expect(resolveDataDir({ env: '', config: {}, userData: '/user' }).source).toBe('default');
  });
});
