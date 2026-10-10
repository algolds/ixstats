/**
 * Autocomplete for @mentions (spec section 5): up to 6 Passport handles and personas whose name starts with what was
 * typed. It reads public data only: a handle with the member's own picture, a persona with its own name and picture.
 * A persona is never joined to its player, and a personal persona is not offered as one (that member is the handle).
 */
import type { PrismaClient } from "@prisma/client";
import {
  MENTION_NAME_MAX,
  MENTION_SUGGEST_MAX,
  MENTION_SUGGEST_MIN,
} from "~/lib/thinkpages-forum/mentions";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";
import { personalAvatars } from "./personal-avatars";

export interface MentionSuggestion {
  kind: "user" | "persona";
  /** What `@` is followed by. */
  name: string;
  /** What the menu shows beside it. */
  label: string;
  avatarUrl: string | null;
}

/** Rows asked of each table: some are dropped (a username a mention cannot spell, a name a handle already has). */
const FETCH = MENTION_SUGGEST_MAX * 2;

/** A persona whose username a mention could actually spell. */
const TYPABLE = /^[A-Za-z0-9_]{3,24}$/;

export async function mentionSuggestions(
  db: Pick<PrismaClient, "user" | "thinkpagesAccount">,
  query: string
): Promise<MentionSuggestion[]> {
  const needle = query.trim().replace(/^@/, "").toLowerCase();
  if (
    needle.length < MENTION_SUGGEST_MIN ||
    needle.length > MENTION_NAME_MAX ||
    !/^[a-z0-9_]+$/.test(needle)
  ) {
    return [];
  }
  const [users, personas] = await Promise.all([
    db.user.findMany({
      where: { handle: { startsWith: needle }, isActive: true },
      orderBy: { handle: "asc" },
      take: FETCH,
      select: { handle: true, clerkUserId: true },
    }),
    db.thinkpagesAccount.findMany({
      where: {
        isActive: true,
        accountType: { not: PERSONAL_ACCOUNT_TYPE },
        OR: [
          { username: { startsWith: needle, mode: "insensitive" } },
          { displayName: { startsWith: needle, mode: "insensitive" } },
        ],
      },
      orderBy: { username: "asc" },
      take: FETCH,
      select: { username: true, displayName: true, profileImageUrl: true },
    }),
  ]);
  const avatars = await personalAvatars(
    db,
    users.map((user) => user.clerkUserId)
  );
  // Handles first, so a handle wins a name a persona also has.
  const suggestions = new Map<string, MentionSuggestion>();
  for (const user of users) {
    if (!user.handle) continue;
    suggestions.set(user.handle, {
      kind: "user",
      name: user.handle,
      label: user.handle,
      avatarUrl: avatars.get(user.clerkUserId) ?? null,
    });
  }
  for (const persona of personas) {
    const key = persona.username.toLowerCase();
    if (!TYPABLE.test(persona.username) || suggestions.has(key)) continue;
    suggestions.set(key, {
      kind: "persona",
      name: persona.username,
      label: persona.displayName,
      avatarUrl: persona.profileImageUrl,
    });
  }
  return [...suggestions.values()].slice(0, MENTION_SUGGEST_MAX);
}
