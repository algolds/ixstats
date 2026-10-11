/**
 * Who a saved post mentions, as `ForumPostMention` rows: the members its own mention links name (a persona's reaches
 * its owner), minus the one author. A row is recorded once, so a later edit tells only the people it adds. The post
 * notices (`post-notify.ts`) and a moderator's edit (`mod-edit.ts`, which tells nobody) share this.
 */
import type { PrismaClient } from "@prisma/client";
import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
import { mentionAnchorNames } from "./mention-html";
import { resolveMentionNames, type MentionDb } from "./mention-links";

/** The members `html`'s mention links name, other than `exceptUserId`. */
export async function mentionedMemberIds(
  db: MentionDb,
  html: string,
  exceptUserId: string | null
): Promise<string[]> {
  const names = mentionAnchorNames(html).slice(0, MENTION_MAX_PER_POST);
  if (names.length === 0) return [];
  const targets = [...(await resolveMentionNames(db, names)).values()];
  const owners = await db.user.findMany({
    where: {
      OR: [
        { id: { in: targets.flatMap((t) => t.userId ?? []) } },
        { clerkUserId: { in: targets.flatMap((t) => t.ownerClerkId ?? []) } },
      ],
    },
    select: { id: true },
  });
  return [...new Set(owners.map((owner) => owner.id))].filter((id) => id !== exceptUserId);
}

/** Records `userIds` as mentioned by the post and returns the ones it had not mentioned before. */
export async function recordMentions(
  db: Pick<PrismaClient, "forumPostMention">,
  postId: string,
  userIds: readonly string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const known = await db.forumPostMention.findMany({
    where: { postId, userId: { in: [...userIds] } },
    select: { userId: true },
  });
  const seen = new Set(known.map((row) => row.userId));
  const fresh = userIds.filter((id) => !seen.has(id));
  if (fresh.length === 0) return [];
  await db.forumPostMention.createMany({
    data: fresh.map((userId) => ({ postId, userId })),
    skipDuplicates: true,
  });
  return fresh;
}
