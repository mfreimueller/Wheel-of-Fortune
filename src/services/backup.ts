import { CURRENT_SCHEMA_VERSION, dbSchema } from '../core/schemas';
import type { RestoreOutcome } from '../shared/types';
import type { LocalStore } from './localStore';

export interface BackupFile {
  name: string;
  json: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function exportBackup(store: LocalStore, now: Date = new Date()): BackupFile {
  const db = store.read();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { name: `wheel-backup-${date}.json`, json: JSON.stringify(db, null, 2) };
}

/** Replaces the whole database; nothing is touched unless the file validates. */
export function importBackup(store: LocalStore, text: string): RestoreOutcome {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-file' };
  }
  const parsed = dbSchema.safeParse(json);
  if (!parsed.success) {
    const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
    return { ok: false, error: typeof version === 'number' && version > CURRENT_SCHEMA_VERSION ? 'newer-schema' : 'invalid-file' };
  }
  store.replaceAll(parsed.data);
  return { ok: true, courseCount: parsed.data.courses.length };
}
