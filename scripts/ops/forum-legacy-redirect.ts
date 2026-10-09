/**
 * ThinkPages forum phase 4: flips the legacy forum switch (SystemConfig `forum_legacy_redirect`). While on, every
 * `/forum/*` page of the old XenForo bridge redirects (307) to the native forum through the import's id map; while
 * off, the bridge renders as before. Running processes pick a flip up within 15 s.
 *   bun run forum:legacy-redirect -- status
 *   bun run forum:legacy-redirect -- on|off [--production]
 * `status` only reads. `on` / `off` refuse the production database ("ixstats") unless --production is passed.
 * Prints the row's value; exits 1 on a bad argument.
 */
import "../lib/load-env";
import { db } from "~/server/db";
import {
  LEGACY_FORUM_REDIRECT_KEY,
  setLegacyForumRedirect,
} from "~/server/modules/thinkpages-forum";
import { databaseLabel, productionDatabaseRefusal } from "../lib/database-guard";

const COMMANDS = ["on", "off", "status"] as const;
type Command = (typeof COMMANDS)[number];

const argv = process.argv.slice(2);
const words = argv.filter((arg) => !arg.startsWith("--"));
const flags = argv.filter((arg) => arg.startsWith("--") && arg !== "--");
const wellFormed = words.length === 1 && flags.every((flag) => flag === "--production");
const command = wellFormed ? COMMANDS.find((name) => name === words[0]) : undefined;

async function printRow(): Promise<void> {
  const row = await db.systemConfig.findUnique({
    where: { key: LEGACY_FORUM_REDIRECT_KEY },
    select: { value: true },
  });
  const value = row ? JSON.stringify(row.value) : "(no row)";
  console.log(`${LEGACY_FORUM_REDIRECT_KEY} = ${value}: ${row?.value === "true" ? "on" : "off"}`);
}

async function main(name: Command): Promise<number> {
  console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);
  if (name !== "status") {
    const refusal = productionDatabaseRefusal(
      process.env.DATABASE_URL,
      argv.includes("--production")
    );
    if (refusal) {
      console.error(refusal);
      return 1;
    }
    await setLegacyForumRedirect(name === "on");
  }
  await printRow();
  return 0;
}

if (!command) {
  console.error("Usage: bun run forum:legacy-redirect -- on|off|status [--production]");
  process.exit(1);
}

main(command)
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
