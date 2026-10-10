/**
 * The forum phase 4 runners' environment (import-xenforo-forum, export-xenforo-forum): as
 * load-env.ts, plus `.env.production.local` first when the run passes `--production`, so a production run reads
 * production's DATABASE_URL, UPLOAD_DIR and keys without sourcing the file into the shell. A side-effect import that
 * must come FIRST: `~/server/db` and `uploadsDir()` read `process.env` when they load or run.
 */
import { envFiles, loadEnvFiles } from "./env-files";

loadEnvFiles(envFiles(process.argv.slice(2)));
