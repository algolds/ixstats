/**
 * Which environment files a script loads, and the loader. dotenv never overrides a variable already set, so the
 * first file in the list that sets a variable wins (and the shell's own environment beats every file).
 *   Default (scripts/lib/load-env.ts): `.env.local.dev`, `.env.local`, `.env`.
 *   Runners with a production mode (scripts/lib/load-runner-env.ts): under `--production`, `.env.production.local`
 *   first, so production's DATABASE_URL and UPLOAD_DIR win over a stale `.env` (forum phase 4, I3).
 * Nothing here prints a value.
 */
import dotenv from "dotenv";

export const DEFAULT_ENV_FILES = [".env.local.dev", ".env.local", ".env"] as const;
export const PRODUCTION_ENV_FILE = ".env.production.local";

/** The files to load, in priority order: the production file first when the run is a production run. */
export function envFiles(argv: readonly string[]): string[] {
  const production = argv.includes("--production");
  return [...(production ? [PRODUCTION_ENV_FILE] : []), ...DEFAULT_ENV_FILES];
}

/** Loads each file relative to the working directory; a missing file is skipped. */
export function loadEnvFiles(files: readonly string[]): void {
  for (const path of files) dotenv.config({ path });
}
