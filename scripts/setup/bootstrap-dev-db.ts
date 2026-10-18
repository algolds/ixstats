#!/usr/bin/env bun

/**
 * Bootstraps an EMPTY local development database from the repository alone:
 * enables PostGIS, pushes the Prisma schema, installs the PostGIS geometry sync
 * triggers and functions `db push` cannot create, and seeds the reference catalogs.
 *
 *   docker compose -f docker-compose.dev.yml up -d
 *   bun run db:bootstrap
 *
 * It refuses to run in production, against a non-local host (unless --allow-remote),
 * or against a database that already holds countries or users. `db:push` is
 * deliberately blocked for the production database; this is the supported way to
 * create a fresh one instead of copying a production dump.
 */

import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres", "db"]);

/** The map tables' geometry → geom_postgis triggers (and their backfill); idempotent. */
export const MAP_GEOMETRY_TRIGGERS_SQL =
  "prisma/migrations/20261007_map_geometry_sync_triggers.sql";

/** Atlas Release 0: Realm.mapVersion, the Country geom_postgis trigger and backfill, atlas_country_union; idempotent. */
export const ATLAS_R0_SQL = "prisma/migrations/20261021120000_atlas_r0/migration.sql";

/** Atlas Release A: Country.worldgen and Country.claimable; idempotent. */
export const ATLAS_RA_SQL = "prisma/migrations/20261022120000_atlas_ra/migration.sql";

/**
 * Atlas and World Studio: the preset tables, and the drop of the dead procedural world models; idempotent. It runs
 * BEFORE `db push`, which refuses to drop a non-empty table the schema no longer has.
 */
export const ATLAS_STUDIO_SQL = "prisma/migrations/20261023120000_atlas_studio/migration.sql";

/** The Vault hub columns, the Lorewards index and the nav-tab reset; idempotent. It runs right after the Atlas Studio SQL. */
export const VAULT_HUB_SQL = "prisma/migrations/20261024120000_vault_hub/migration.sql";

/** Cards refresh Phase 1: the additive SQL (before the backfill); idempotent, and a no-op after a fresh db push. */
export const CARDS_FOUNDATIONS_SQL =
  "prisma/migrations/20261027120000_cards_foundations/migration.sql";

/** Cards refresh Phase 1: the constraints (after the backfill); on a fresh database it adds the Lore natural key. */
export const CARDS_CONSTRAINTS_SQL =
  "prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql";

/** The cards backfill; on a fresh database it only seeds Ixnay and the system realms the card tables point at. */
export const CARDS_BACKFILL_SCRIPT = "scripts/cards/backfill-cards-refresh.ts";

/** Cards refresh Phase 2: review state, import jobs, art licences, takedowns, Special card fields; idempotent. */
export const CARDS_ADMIN_SQL = "prisma/migrations/20261028120000_cards_admin/migration.sql";

/**
 * Cards refresh Phase 3: collector numbers and their trigger, the showcase pin and its detach trigger, and the drop of
 * collection likes and comments; idempotent. On a fresh database it runs after `db push` and installs the triggers.
 */
export const CARDS_FACE_HUB_SQL = "prisma/migrations/20261031120000_cards_face_hub/migration.sql";

/**
 * Cards refresh Phase 4: listings, dust, market prices, mutes, inscription reports and the status enums; idempotent.
 * On a fresh database it runs after `db push`, where every statement is a no-op.
 */
export const CARDS_ECONOMY_SQL = "prisma/migrations/20261101120000_cards_economy/migration.sql";

/** The SQL `db push` cannot apply, in the order it runs (the triggers first: the Atlas SQL backfills through them). */
export const DB_SETUP_SQL_FILES = [MAP_GEOMETRY_TRIGGERS_SQL, ATLAS_R0_SQL, ATLAS_RA_SQL];

export interface BootstrapGuardInput {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
  allowRemote: boolean;
}

/** Why bootstrapping must not proceed, or null when it may. */
export function bootstrapRefusal({
  nodeEnv,
  databaseUrl,
  allowRemote,
}: BootstrapGuardInput): string | null {
  if (nodeEnv === "production") return "NODE_ENV is production; bootstrap is for development only.";
  if (!databaseUrl) return "DATABASE_URL is not set (copy .env.example to .env.local).";
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    return "DATABASE_URL is not a valid URL.";
  }
  if (!allowRemote && !LOCAL_HOSTS.has(host)) {
    return `DATABASE_URL points at "${host}", not a local database. Pass --allow-remote if that is intended.`;
  }
  return null;
}

function run(command: string, args: string[]): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status ?? result.signal}`);
  }
}

/** Rows in a table, or 0 when the table does not exist yet (a fresh database). */
async function countRows(db: PrismaClient, table: string): Promise<number> {
  try {
    const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM "${table}"`
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const refusal = bootstrapRefusal({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    allowRemote: process.argv.includes("--allow-remote"),
  });
  if (refusal) {
    console.error(`✗ ${refusal}`);
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const countries = await countRows(db, "Country");
    const users = await countRows(db, "User");
    if (countries > 0 || users > 0) {
      console.error(
        `✗ The database already has ${countries} countries and ${users} users. Bootstrap only ` +
          "creates empty databases; use db:push:force deliberately to change an existing one."
      );
      process.exit(1);
    }

    console.log("🗺️  Enabling PostGIS (the schema has geometry columns)...");
    await db.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS postgis");
  } finally {
    await db.$disconnect();
  }

  run("bunx", ["prisma", "db", "execute", "--schema", "prisma/schema", "--file", ATLAS_STUDIO_SQL]);
  run("bunx", ["prisma", "db", "execute", "--schema", "prisma/schema", "--file", VAULT_HUB_SQL]);
  run("bunx", ["prisma", "db", "push", "--skip-generate"]);
  console.log("🗺️  Installing the map geometry triggers and the Atlas functions...");
  for (const file of DB_SETUP_SQL_FILES) {
    run("bunx", ["prisma", "db", "execute", "--schema", "prisma/schema", "--file", file]);
  }
  console.log("🃏 Cards foundations: the additive SQL, the backfill, then the constraints...");
  run("bunx", [
    "prisma",
    "db",
    "execute",
    "--schema",
    "prisma/schema",
    "--file",
    CARDS_FOUNDATIONS_SQL,
  ]);
  run("bun", [CARDS_BACKFILL_SCRIPT, "--apply"]);
  run("bunx", [
    "prisma",
    "db",
    "execute",
    "--schema",
    "prisma/schema",
    "--file",
    CARDS_CONSTRAINTS_SQL,
  ]);
  run("bunx", ["prisma", "db", "execute", "--schema", "prisma/schema", "--file", CARDS_ADMIN_SQL]);
  run("bunx", [
    "prisma",
    "db",
    "execute",
    "--schema",
    "prisma/schema",
    "--file",
    CARDS_FACE_HUB_SQL,
  ]);
  run("bunx", [
    "prisma",
    "db",
    "execute",
    "--schema",
    "prisma/schema",
    "--file",
    CARDS_ECONOMY_SQL,
  ]);
  run("bun", ["scripts/setup/seed-db.ts", "--force"]);

  console.log(`
✅ Development database ready.
Next:
  1. bun run dev, sign in, and create a nation at /builder.
  2. Make yourself an admin: add your Clerk user id to SYSTEM_OWNER_IDS in .env.local,
     then run bun run set-admin-role.
`);
}

if (import.meta.main || process.argv[1]?.endsWith("bootstrap-dev-db.ts")) {
  main().catch((error) => {
    console.error("❌ Bootstrap failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
