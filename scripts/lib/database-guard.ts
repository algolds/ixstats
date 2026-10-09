/**
 * The data-migration runners' database guard (scripts/migrations/archive-realm-boards.ts, migrate-board-bans.ts):
 * they refuse the production database unless `--production` is passed, and print which database they talk to.
 */

/** The production database's name. */
const PRODUCTION_DATABASE = "ixstats";

/** Why a runner must not touch the database in `databaseUrl`, or null when it may. */
export function productionDatabaseRefusal(
  databaseUrl: string | undefined,
  production: boolean
): string | null {
  let name: string;
  try {
    name = decodeURIComponent(new URL(databaseUrl ?? "").pathname.replace(/^\//, ""));
  } catch {
    return "DATABASE_URL is not set or not a URL.";
  }
  if (name === PRODUCTION_DATABASE && !production) {
    return `DATABASE_URL names the production database "${PRODUCTION_DATABASE}". Run against a clone, or pass --production if that is intended.`;
  }
  return null;
}

/** `host:port/database`, never the credentials. */
export function databaseLabel(url: string | undefined): string {
  try {
    const parsed = new URL(url ?? "");
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL is not set or not a URL)";
  }
}
