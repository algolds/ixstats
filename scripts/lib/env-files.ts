/**
 * Which environment files a script loads (scripts/lib/load-env.ts: `.env.local.dev`, `.env.local`, `.env`), and the
 * loader. dotenv never overrides a variable already set, so the first file in the list that sets a variable wins (and
 * the shell's own environment beats every file). Nothing here prints a value.
 */
import dotenv from "dotenv";

export const DEFAULT_ENV_FILES = [".env.local.dev", ".env.local", ".env"] as const;

/** Loads each file relative to the working directory; a missing file is skipped. */
export function loadEnvFiles(files: readonly string[]): void {
  for (const path of files) dotenv.config({ path });
}
