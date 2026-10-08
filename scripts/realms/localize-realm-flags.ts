/**
 * A realm's nation flags and coats of arms as local files (`public/flags/`, registered in metadata.json, the
 * country pointing at `/flags/<file>`), when its map pipeline config has `flags.localize`: the pipeline's `flags`
 * step (src/server/modules/realms/realms.flags.ts), run in process. Idempotent: re-run it after every source sync
 * apply and after claim approvals.
 *   bun scripts/realms/localize-realm-flags.ts --realm <slug> [--apply]
 * Writes `public/flags/` under the current directory: run it from the app root. Production serves the standalone
 * build's copy (`.next/standalone/public`), so copy the new files there too. Shared arguments: realm-map-cli.ts.
 */
import { realmMapCli } from "./realm-map-cli";

realmMapCli("localize-realm-flags", ["flags"]);
