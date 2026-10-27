/**
 * Loads the operator's environment files, in the order the sync and audit scripts always did (the first file that
 * sets a variable wins): `.env.local.dev`, `.env.local`, `.env`, relative to the working directory.
 *
 * A side-effect import, and it must be the FIRST import of a script that reads `wikiosConfig`: imports run in
 * order, and `src/lib/wiki-os/config.ts` builds the config from `process.env` the moment it loads, so a
 * `dotenv.config()` written after the imports ran too late and the script talked to the default host.
 */
import { DEFAULT_ENV_FILES, loadEnvFiles } from "./env-files";

loadEnvFiles(DEFAULT_ENV_FILES);
