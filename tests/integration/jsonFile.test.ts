import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readJsonFile, restoreBackup, writeJsonAtomic } from '../../src/main/store/jsonFile';

const schema = z.object({ schemaVersion: z.literal(1), name: z.string() });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wheel-json-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeJsonAtomic', () => {
  it('creates missing directories and writes pretty JSON', async () => {
    const file = join(dir, 'a', 'b', 'x.json');
    await writeJsonAtomic(file, { schemaVersion: 1, name: 'one' });
    expect(JSON.parse(await readFile(file, 'utf-8'))).toEqual({ schemaVersion: 1, name: 'one' });
    expect(await readFile(file, 'utf-8')).toContain('\n  "name"');
  });

  it('keeps the previous version as .bak and leaves no .tmp behind', async () => {
    const file = join(dir, 'x.json');
    await writeJsonAtomic(file, { schemaVersion: 1, name: 'one' });
    await writeJsonAtomic(file, { schemaVersion: 1, name: 'two' });
    expect(JSON.parse(await readFile(`${file}.bak`, 'utf-8')).name).toBe('one');
    expect(JSON.parse(await readFile(file, 'utf-8')).name).toBe('two');
    expect((await readdir(dir)).sort()).toEqual(['x.json', 'x.json.bak']);
  });

  it('serializes concurrent writes to the same file; the last one wins', async () => {
    const file = join(dir, 'x.json');
    await Promise.all(Array.from({ length: 20 }, (_, i) => writeJsonAtomic(file, { schemaVersion: 1, name: `n${i}` })));
    expect(JSON.parse(await readFile(file, 'utf-8')).name).toBe('n19');
  });
});

describe('readJsonFile', () => {
  it('returns the parsed value', async () => {
    const file = join(dir, 'x.json');
    await writeJsonAtomic(file, { schemaVersion: 1, name: 'one' });
    expect(await readJsonFile(file, schema)).toEqual({ ok: true, value: { schemaVersion: 1, name: 'one' } });
  });

  it('reports a missing file', async () => {
    const result = await readJsonFile(join(dir, 'nope.json'), schema);
    expect(result).toMatchObject({ ok: false, error: { kind: 'missing' } });
  });

  it('reports malformed JSON without touching the file', async () => {
    const file = join(dir, 'x.json');
    await writeFile(file, '{ not json');
    const result = await readJsonFile(file, schema);
    expect(result).toMatchObject({ ok: false, error: { kind: 'invalid', backupAvailable: false } });
    expect(await readFile(file, 'utf-8')).toBe('{ not json');
  });

  it('reports a schema violation with a readable message', async () => {
    const file = join(dir, 'x.json');
    await writeFile(file, JSON.stringify({ schemaVersion: 1, name: 5 }));
    const result = await readJsonFile(file, schema);
    expect(result).toMatchObject({ ok: false, error: { kind: 'invalid' } });
    expect(!result.ok && result.error.message).toContain('name');
  });

  it('refuses a file written by a newer schema version', async () => {
    const file = join(dir, 'x.json');
    await writeFile(file, JSON.stringify({ schemaVersion: 2, name: 'future' }));
    expect(await readJsonFile(file, schema)).toMatchObject({ ok: false, error: { kind: 'newer-schema' } });
  });
});

describe('restoreBackup', () => {
  it('offers and applies a valid .bak when the main file is broken', async () => {
    const file = join(dir, 'x.json');
    await writeJsonAtomic(file, { schemaVersion: 1, name: 'good' });
    await writeJsonAtomic(file, { schemaVersion: 1, name: 'newer' }); // .bak = good
    await writeFile(file, '{ broken');

    const broken = await readJsonFile(file, schema);
    expect(broken).toMatchObject({ ok: false, error: { kind: 'invalid', backupAvailable: true } });

    const restored = await restoreBackup(file, schema);
    expect(restored).toEqual({ ok: true, value: { schemaVersion: 1, name: 'good' } });
    expect(await readJsonFile(file, schema)).toEqual({ ok: true, value: { schemaVersion: 1, name: 'good' } });
  });

  it('fails when there is no valid backup', async () => {
    const file = join(dir, 'x.json');
    await writeFile(file, '{ broken');
    expect(await restoreBackup(file, schema)).toMatchObject({ ok: false });
  });
});
