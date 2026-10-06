#!/usr/bin/env bun

/**
 * Lists users whose `User.wikiUsername` is set without a VERIFIED ixwiki WikiAccountLink (plan 401 S4).
 * Read-only: it runs SELECTs against a LOCAL database and never writes.
 *
 * Until 2026-09-30, the first WikiOS save wrote `User.wikiUsername = <country name>` for the editor, so
 * many rows hold a name nobody ever proved they own. WikiOS no longer authorizes on that column (it uses
 * `WikiAccountLink.verifiedAt`), but it is still the display/attribution fallback and feeds the by-name
 * profile lookup, so the unverified values should be cleared. A user who later verifies a real wiki
 * account gets a proper link and loses nothing.
 *
 * Run with:
 *   bun scripts/audit/wikios-legacy-wikiusername.ts              (table)
 *   bun scripts/audit/wikios-legacy-wikiusername.ts --json       (machine-readable)
 *   bun scripts/audit/wikios-legacy-wikiusername.ts --emit-sql   (UPDATE statements on stdout, summary on stderr)
 *
 * `--emit-sql` only PRINTS statements for the operator to review and run; each one is guarded by the
 * current value (`AND "wikiUsername" = '<name>'`) so it cannot clobber a name changed since the audit.
 */

import { PrismaClient } from "@prisma/client";

export interface LegacyWikiUsernameRow {
  id: string;
  clerkUserId: string;
  wikiUsername: string;
  country: string | null;
  /** The name equals the user's country name, the signature of the old saveArticle auto-write. */
  matchesCountryName: boolean;
  /** An unverified ixwiki link exists (a verification in progress), with its username. */
  pendingLinkUsername: string | null;
  lastWikiSync: string | null;
}

interface LegacyUserRecord {
  id: string;
  clerkUserId: string;
  wikiUsername: string | null;
  lastWikiSync: Date | null;
  country: { name: string } | null;
  wikiAccountLinks: Array<{ username: string }>;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** True only for a DATABASE_URL that points at this machine. The URL itself is never printed. */
export function isLocalDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

const comparable = (name: string) => name.replace(/_/g, " ").trim().toLowerCase();

/** The rows to report: a non-blank wikiUsername is set (the server treats blank as unset). */
export function toLegacyRows(users: LegacyUserRecord[]): LegacyWikiUsernameRow[] {
  return users
    .filter((u): u is LegacyUserRecord & { wikiUsername: string } => Boolean(u.wikiUsername?.trim()))
    .map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      wikiUsername: u.wikiUsername,
      country: u.country?.name ?? null,
      matchesCountryName:
        u.country !== null && comparable(u.country.name) === comparable(u.wikiUsername),
      pendingLinkUsername: u.wikiAccountLinks[0]?.username ?? null,
      lastWikiSync: u.lastWikiSync?.toISOString() ?? null,
    }));
}

/** A SQL string literal: single quotes doubled (standard_conforming_strings is on by default). */
export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** One guarded UPDATE per row; the `wikiUsername` check makes a stale audit a no-op. */
export function buildResetSql(rows: LegacyWikiUsernameRow[]): string[] {
  return rows.map(
    (r) =>
      `UPDATE "User" SET "wikiUsername" = NULL WHERE id = ${sqlString(r.id)} AND "wikiUsername" = ${sqlString(r.wikiUsername)};`
  );
}

async function loadLegacyRows(prisma: PrismaClient): Promise<LegacyWikiUsernameRow[]> {
  const users = await prisma.user.findMany({
    where: {
      wikiUsername: { not: null },
      wikiAccountLinks: { none: { source: "ixwiki", verifiedAt: { not: null } } },
    },
    select: {
      id: true,
      clerkUserId: true,
      wikiUsername: true,
      lastWikiSync: true,
      country: { select: { name: true } },
      wikiAccountLinks: { where: { source: "ixwiki" }, select: { username: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100_000,
  });
  return toLegacyRows(users);
}

function printReport(rows: LegacyWikiUsernameRow[], out: (line: string) => void): void {
  const autoWritten = rows.filter((r) => r.matchesCountryName).length;
  out(`Users with a wikiUsername but no verified ixwiki link: ${rows.length}`);
  out(`  of which the name equals the user's country name (old auto-write): ${autoWritten}`);
  out(`  of which an unverified link exists (verification in progress): ${rows.filter((r) => r.pendingLinkUsername).length}`);
}

async function runCLI(): Promise<void> {
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    console.error(
      "[audit:wikios-legacy-wikiusername] refusing to run: DATABASE_URL is not set or does not point at localhost."
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const rows = await loadLegacyRows(prisma);

    if (process.argv.includes("--emit-sql")) {
      console.log("-- Clears unverified User.wikiUsername values. Review, then run as the operator.");
      for (const statement of buildResetSql(rows)) console.log(statement);
      printReport(rows, (line) => console.error(line));
    } else if (process.argv.includes("--json")) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      printReport(rows, (line) => console.log(line));
      console.log("");
      console.table(
        rows.map((r) => ({
          userId: r.id,
          clerkUserId: r.clerkUserId,
          wikiUsername: r.wikiUsername,
          country: r.country ?? "",
          "= country": r.matchesCountryName ? "yes" : "",
          pendingLink: r.pendingLinkUsername ?? "",
          lastWikiSync: r.lastWikiSync ?? "",
        }))
      );
      console.log("\nRun with --emit-sql to print UPDATE statements that clear these values.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.main) {
  runCLI().catch((error) => {
    console.error("[audit:wikios-legacy-wikiusername] failed:", error);
    process.exitCode = 1;
  });
}
