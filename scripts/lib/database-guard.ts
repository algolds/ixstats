/**
 * The data-migration runners' database guards (scripts/migrations/archive-realm-boards.ts, migrate-board-bans.ts and
 * others): they refuse the production database unless `--production` is passed, and print which database they talk
 * to. A runner for local databases only (import-realm-board-history.ts) also refuses any database that is not local.
 */

/** The production database's name. */
const PRODUCTION_DATABASE = "ixstats";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Why a runner must not touch the database in `databaseUrl`, or null when it may. */
export function productionDatabaseRefusal(
  databaseUrl: string | undefined,
  production: boolean
): string | null {
  let name: string;
  try {
    name = decodeURIComponent(new URL(databaseUrl ?? "").pathname.replace(/^\/|\/$/g, ""));
  } catch {
    return "DATABASE_URL is not set or not a URL.";
  }
  if (name === PRODUCTION_DATABASE && !production) {
    return `DATABASE_URL names the production database "${PRODUCTION_DATABASE}". Run against a clone, or pass --production if that is intended.`;
  }
  return null;
}

/** Why the database in `databaseUrl` is not a local one, or null. */
export function localDatabaseRefusal(databaseUrl: string | undefined): string | null {
  try {
    const { hostname, searchParams } = new URL(databaseUrl ?? "");
    // `host` and `hostaddr` query parameters override the URL's host, so a localhost URL can point anywhere.
    if (searchParams.has("host") || searchParams.has("hostaddr")) {
      return "DATABASE_URL carries a host or hostaddr parameter, which can redirect it. This script only runs against a local database.";
    }
    return LOCAL_HOSTS.has(hostname)
      ? null
      : `DATABASE_URL names ${hostname}, which is not local. This script only runs against a local database (the clone or the dev database).`;
  } catch {
    return "DATABASE_URL is not set or not a URL.";
  }
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
