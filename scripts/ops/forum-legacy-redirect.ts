/**
 * ThinkPages forum phase 4: flips the legacy forum switch (SystemConfig `forum_legacy_redirect`). While on, every
 * `/forum/*` page of the old XenForo bridge redirects (307) to the native forum through the import's id map; while
 * off, the bridge renders as before. Running processes pick a flip up within 15 s.
 *   bun run forum:legacy-redirect -- status
 *   bun run forum:legacy-redirect -- [--production] on|off
 * `status` only reads. `on` / `off` refuse the production database ("ixstats") unless --production is passed, which
 * also loads `.env.production.local` first (scripts/lib/load-runner-env.ts). Prints the row's value; exits 1 on a bad
 * argument.
 */
import "../lib/load-runner-env";
import { db } from "~/server/db";
import {
  LEGACY_FORUM_REDIRECT_KEY,
  setLegacyForumRedirect,
} from "~/server/modules/thinkpages-forum";
import { databaseLabel, productionDatabaseRefusal } from "../lib/database-guard";
import { parseLegacyRedirectArgs, type LegacyRedirectCommand } from "./forum-legacy-redirect-args";

const parsed = parseLegacyRedirectArgs(process.argv.slice(2));

async function printRow(): Promise<void> {
  const row = await db.systemConfig.findUnique({
    where: { key: LEGACY_FORUM_REDIRECT_KEY },
    select: { value: true },
  });
  const value = row ? JSON.stringify(row.value) : "(no row)";
  console.log(`${LEGACY_FORUM_REDIRECT_KEY} = ${value}: ${row?.value === "true" ? "on" : "off"}`);
}

async function main(name: LegacyRedirectCommand, production: boolean): Promise<number> {
  console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);
  if (name !== "status") {
    const refusal = productionDatabaseRefusal(process.env.DATABASE_URL, production);
    if (refusal) {
      console.error(refusal);
      return 1;
    }
    await setLegacyForumRedirect(name === "on");
  }
  await printRow();
  return 0;
}

if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(1);
}

main(parsed.command, parsed.production)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  // The server modules' imports open a Redis client (the rate limiter) that keeps the event loop alive: exit.
  .finally(async () => {
    await db.$disconnect();
    process.exit();
  });
