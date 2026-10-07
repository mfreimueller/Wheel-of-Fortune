import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { writeJsonAtomic } from './store/jsonFile';

const configSchema = z.object({ dataDir: z.string().min(1).optional() });
export type Config = z.infer<typeof configSchema>;

const fileOf = (userData: string): string => join(userData, 'config.json');

/** The only setting that cannot live inside the data folder itself: where the data folder is. */
export async function readConfig(userData: string): Promise<Config> {
  try {
    const parsed = configSchema.safeParse(JSON.parse(await readFile(fileOf(userData), 'utf-8')));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function writeConfig(userData: string, config: Config): Promise<void> {
  return writeJsonAtomic(fileOf(userData), config);
}

export interface DataDirChoice {
  dataDir: string;
  /** `env` cannot be changed from the settings dialog. */
  source: 'env' | 'config' | 'default';
}

export function resolveDataDir(input: { env: string | undefined; config: Config; userData: string }): DataDirChoice {
  if (input.env) return { dataDir: input.env, source: 'env' };
  if (input.config.dataDir) return { dataDir: input.config.dataDir, source: 'config' };
  return { dataDir: join(input.userData, 'data'), source: 'default' };
}
