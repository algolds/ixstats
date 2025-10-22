#!/usr/bin/env tsx

/**
 * Verifies user ↔ country linkage integrity across the IxStats database.
 *  - Ensures every active Clerk user has a User record.
 *  - Highlights users without a linked country.
 *  - Detects ThinkPages accounts whose owners are not linked to their country.
 *
 * Run with:
 *   tsx scripts/audit/verify-country-links.ts
 *
 * For production database:
 *   DATABASE_URL=file:./prisma/prod.db tsx scripts/audit/verify-country-links.ts
 */

import { PrismaClient } from "@prisma/client";
import { SYSTEM_OWNER_IDS } from "../../src/lib/system-owner-constants";

const prisma = new PrismaClient();
const SYSTEM_OWNER_SET = new Set<string>(SYSTEM_OWNER_IDS);

type SummaryRow = {
  clerkUserId: string;
  hasUserRecord: boolean;
  linkedCountryId: string | null;
  detectedCountryId: string | null;
  source: "user" | "thinkpages";
};

async function fetchThinkPagesLinks(): Promise<SummaryRow[]> {
  const accounts = await prisma.thinkpagesAccount.findMany({
    where: { isActive: true },
    select: {
      clerkUserId: true,
      countryId: true,
    },
  });

  if (!accounts.length) return [];

  const rows = await Promise.all(
    accounts.map(async (account) => {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: account.clerkUserId },
        select: {
          countryId: true,
        },
      });

      return {
        clerkUserId: account.clerkUserId,
        hasUserRecord: Boolean(user),
        linkedCountryId: user?.countryId ?? null,
        detectedCountryId: account.countryId,
        source: "thinkpages" as const,
      };
    })
  );

  return rows.filter(
    (row) => !row.linkedCountryId && !SYSTEM_OWNER_SET.has(row.clerkUserId)
  );
}

async function fetchUnlinkedUsers(): Promise<SummaryRow[]> {
  const users = await prisma.user.findMany({
    where: { OR: [{ countryId: null }, { countryId: "" }] },
    select: {
      clerkUserId: true,
      countryId: true,
    },
  }).filter((row) => !SYSTEM_OWNER_SET.has(row.clerkUserId));

  return users.map((user) => ({
    clerkUserId: user.clerkUserId,
    hasUserRecord: true,
    linkedCountryId: user.countryId ?? null,
    detectedCountryId: null,
    source: "user" as const,
  }));
}

async function main() {
  console.log("🔍 Verifying country linkage integrity");
  console.log(`   Database: ${process.env.DATABASE_URL ?? "(default connection)"}`);
  if (SYSTEM_OWNER_IDS.length) {
    console.log(
      `   Note: System owner accounts (${SYSTEM_OWNER_IDS.join(
        ", "
      )}) are excluded from linkage warnings.`
    );
  }
  console.log("");

  const [totalUsers, linkedUsers, totalThinkPages] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { NOT: { countryId: null } } }),
    prisma.thinkpagesAccount.count({ where: { isActive: true } }),
  ]);

  const [unlinkedUsers, orphanedAccounts] = await Promise.all([
    fetchUnlinkedUsers(),
    fetchThinkPagesLinks(),
  ]);

  console.log("📊 Summary");
  console.table({
    "User records": totalUsers,
    "Users with linked country": linkedUsers,
    "Users missing country link": unlinkedUsers.length,
    "Active ThinkPages accounts": totalThinkPages,
    "Accounts missing owner link": orphanedAccounts.length,
  });

  if (unlinkedUsers.length) {
    console.log("\n⚠️  Users without linked countries");
    console.table(
      unlinkedUsers.map((row) => ({
        clerkUserId: row.clerkUserId,
        linkedCountryId: row.linkedCountryId,
      }))
    );
  } else {
    console.log("\n✅ All users have linked countries.");
  }

  if (orphanedAccounts.length) {
    console.log("\n⚠️  ThinkPages accounts with unlinked owners");
    console.table(
      orphanedAccounts.map((row) => ({
        clerkUserId: row.clerkUserId,
        detectedCountryId: row.detectedCountryId,
      }))
    );
  } else {
    console.log("\n✅ All ThinkPages accounts have corresponding country links.");
  }
}

main()
  .catch((error) => {
    console.error("❌ Country linkage audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
