/**
 * Country flags and coats of arms stored as raw IIWiki URLs (`https://iiwiki.com/images/...`) become media-proxy
 * paths (`/api/mediawiki/iiwiki/images/...`, no base path), so readers load them through the IIWiki gate
 * (iiwiki-switch.ts) instead of straight from iiwiki.com. New nation prefills store that form already
 * (realms.prefill.ts). Dry run by default; pass --apply to write. Idempotent.
 *   bun scripts/realms/backfill-iiwiki-image-paths.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { planIiwikiImagePaths } from "~/lib/flags/iiwiki-image-backfill";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

/** The database this run touches, without credentials: host, port and name. */
function target(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (!URL.canParse(raw)) return "(DATABASE_URL unset or unreadable)";
  const url = new URL(raw);
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

async function main() {
  console.log(`Database: ${target()} (${apply ? "APPLY" : "dry run"})`);
  const countries = await db.country.findMany({
    where: {
      OR: [{ flag: { contains: "iiwiki." } }, { coatOfArms: { contains: "iiwiki." } }],
    },
    select: { id: true, name: true, flag: true, coatOfArms: true },
  });
  const { updates, skipped } = planIiwikiImagePaths(countries);
  console.log(
    `${countries.length} countries name IIWiki; ${updates.length} to rewrite, ${skipped.length} left as they are`
  );
  for (const u of updates.slice(0, 10)) console.log(`  ${u.name}: ${JSON.stringify(u.data)}`);
  for (const s of skipped) console.log(`  SKIP ${s.name} (${s.field}): ${s.value}`);
  if (!apply) {
    console.log("Dry run: nothing written. Pass --apply to write.");
    return;
  }
  for (const u of updates) {
    await db.country.update({ where: { id: u.id }, data: u.data, select: { id: true } });
  }
  console.log(`Rewrote ${updates.length} countries.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
