import { copyFile, mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { fail, ok, type Result } from '../../core/result';
import { CURRENT_SCHEMA_VERSION } from '../../core/schemas';
import type { ReadError } from '../../shared/types';

// Writes to the same file run one after another so a slow write can never overtake a newer one.
const queues = new Map<string, Promise<void>>();

export function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => writeOnce(file, data));
  queues.set(file, next);
  const cleanup = (): void => {
    if (queues.get(file) === next) queues.delete(file);
  };
  next.then(cleanup, cleanup);
  return next;
}

async function writeOnce(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  // Only a parseable current file becomes the backup, so a corrupted file never replaces a good .bak.
  if (await isParseableJson(file)) await copyFile(file, `${file}.bak`);
  await rename(tmp, file);
}

async function isParseableJson(file: string): Promise<boolean> {
  try {
    JSON.parse(await readFile(file, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<S extends z.ZodType>(file: string, schema: S): Promise<Result<z.output<S>, ReadError>> {
  let text: string;
  try {
    text = await readFile(file, 'utf-8');
  } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
    return fail({ kind: missing ? 'missing' : 'unreadable', file, message: (e as Error).message, backupAvailable: false });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return fail(await invalid(file, schema, `Ungültiges JSON: ${(e as Error).message}`));
  }

  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
    return fail({
      kind: 'newer-schema',
      file,
      message: `Die Datei wurde mit einer neueren Version erstellt (Schema ${version}, unterstützt: ${CURRENT_SCHEMA_VERSION}).`,
      backupAvailable: false,
    });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(await invalid(file, schema, z.prettifyError(parsed.error)));
  return ok(parsed.data);
}

async function invalid(file: string, schema: z.ZodType, message: string): Promise<ReadError> {
  return { kind: 'invalid', file, message, backupAvailable: await backupIsValid(file, schema) };
}

async function backupIsValid(file: string, schema: z.ZodType): Promise<boolean> {
  try {
    return schema.safeParse(JSON.parse(await readFile(`${file}.bak`, 'utf-8'))).success;
  } catch {
    return false;
  }
}

/** Replaces a broken file with its last good backup. */
export async function restoreBackup<S extends z.ZodType>(file: string, schema: S): Promise<Result<z.output<S>, ReadError>> {
  const backup = await readJsonFile(`${file}.bak`, schema);
  if (!backup.ok) return fail({ ...backup.error, file });
  await writeJsonAtomic(file, backup.value);
  return backup;
}
