/**
 * bot-passwords.ts — Special:BotPasswords: create, list and delete a user's bot passwords (plan 410).
 *
 * The password is generated here, returned once and stored only as an scrypt hash. A user needs a
 * verified wiki link (the router checks), because api.php names the account by it. Deleting a bot
 * password also ends its sessions (the foreign key cascades).
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { APP_ID_PATTERN, generateBotPassword, hashBotPassword } from "./auth";
import { BOT_GRANTS, isBotGrant, type BotGrant } from "./grants";

/** Bot passwords one user may hold. */
export const MAX_BOT_PASSWORDS = 20;

export interface BotPasswordSummary {
  id: string;
  appId: string;
  grants: BotGrant[];
  createdAt: Date;
  lastUsedAt: Date | null;
}

const SUMMARY_SELECT = {
  id: true,
  appId: true,
  grants: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

function toSummary(row: {
  id: string;
  appId: string;
  grants: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
}): BotPasswordSummary {
  return { ...row, grants: row.grants.filter(isBotGrant) };
}

export async function listBotPasswords(userId: string): Promise<BotPasswordSummary[]> {
  const rows = await db.wikiBotPassword.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: MAX_BOT_PASSWORDS,
    select: SUMMARY_SELECT,
  });
  return rows.map(toSummary);
}

/** Create a bot password; `password` is shown to the user once and cannot be read again. */
export async function createBotPassword(
  userId: string,
  input: { appId: string; grants: readonly string[] }
): Promise<{ summary: BotPasswordSummary; password: string }> {
  const appId = input.appId.trim();
  if (!APP_ID_PATTERN.test(appId)) {
    throw new PageOperationError(
      "BAD_REQUEST",
      "The app id may hold letters, digits, spaces, underscores and hyphens, at most 32."
    );
  }
  const unknown = input.grants.find((grant) => !isBotGrant(grant));
  if (unknown) throw new PageOperationError("BAD_REQUEST", `"${unknown}" is not a grant.`);
  // `basic` is always in force; storing it keeps the list honest.
  const grants = BOT_GRANTS.filter((grant) => grant === "basic" || input.grants.includes(grant));

  const [existing, count] = await Promise.all([
    db.wikiBotPassword.findUnique({
      where: { userId_appId: { userId, appId } },
      select: { id: true },
    }),
    db.wikiBotPassword.count({ where: { userId } }),
  ]);
  if (existing) {
    throw new PageOperationError("CONFLICT", `You already have a bot password named "${appId}".`);
  }
  if (count >= MAX_BOT_PASSWORDS) {
    throw new PageOperationError(
      "BAD_REQUEST",
      `You can have at most ${MAX_BOT_PASSWORDS} bot passwords.`
    );
  }

  const password = generateBotPassword();
  try {
    const row = await db.wikiBotPassword.create({
      data: { userId, appId, grants, passwordHash: await hashBotPassword(password) },
      select: SUMMARY_SELECT,
    });
    return { summary: toSummary(row), password };
  } catch (error) {
    // Two requests created the same app id at once: the unique index decided.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PageOperationError("CONFLICT", `You already have a bot password named "${appId}".`);
    }
    throw error;
  }
}

/** Delete one of the user's bot passwords (and its sessions). */
export async function deleteBotPassword(userId: string, id: string): Promise<void> {
  const removed = await db.wikiBotPassword.deleteMany({ where: { id, userId } });
  if (removed.count === 0) throw new PageOperationError("NOT_FOUND", "No such bot password.");
}
