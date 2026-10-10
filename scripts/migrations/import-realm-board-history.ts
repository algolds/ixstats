/**
 * ThinkPages realm board: copy each realm's old Realm Board chat into its board thread as history, oldest first, under
 * the original author and time. The old chat is the board group's ThinkShare conversation (ThinkshareMessage).
 *   bun run forum:import-board-history [-- --apply]
 * Dry run by default; --apply writes. Refuses the production database ("ixstats"), has no --production flag, and
 * refuses any database that is not local: run it on the clone or the dev database. Idempotent by `sourceRef`
 * ("realm_board_message:<messageId>"): a rerun creates nothing new and a partial earlier run is completed. Deleted and
 * system messages and messages with no text are skipped and reported. Full text is kept (the 1,000 character cap is
 * for new messages). The "Realm Board archive" thread is left as it is. Preflight: every board with messages to
 * import must have its board thread (apply the realm board migration and seeding first). Exit codes: 0 done; 1 refused.
 */
import "../lib/load-env";
import { PrismaClient } from "@prisma/client";
import { databaseLabel } from "../lib/database-guard";
import { runBoardHistory } from "./import-realm-board-history-run";
import { parseBoardHistoryArgs } from "./import-realm-board-history-plan";

const parsed = parseBoardHistoryArgs(process.argv.slice(2), process.env.DATABASE_URL);
if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(1);
}
console.log(parsed.args.apply ? "APPLY mode" : "DRY RUN: pass --apply to write");
console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);

const db = new PrismaClient();
let code = 1;
runBoardHistory(db, parsed.args.apply)
  .then((result) => {
    code = result;
  })
  .catch((error: Error) => {
    console.error(error);
  })
  // The server modules' imports open a Redis client (the rate limiter) that keeps the event loop alive: exit.
  .finally(async () => {
    try {
      await db.$disconnect();
    } finally {
      process.exit(code);
    }
  });
