/**
 * Resolving @names and linking them when a post is saved (spec section 5). A name is a Passport handle first
 * (`User.handle`, lower case) and a persona's `username` second (a persona's mention reaches its owner). The handle
 * wins a shared name; at most the first 50 names of a post are resolved and linked, the rest stay plain text. The link
 * goes to the handle's Passport page or the persona's profile. A personal persona is the member's Passport under
 * another table, so it is never a persona target: the member is reached by handle.
 */
import type { PrismaClient } from "@prisma/client";
import { handleProfileHref, personaProfileHref } from "~/lib/thinkpages-forum/links";
import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
import { stripPositioning } from "~/lib/thinkpages-forum/strip-positioning";
import { sanitizeUserContent, sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";
import { linkMentionsInHtml, mentionNamesInHtml, unwrapMentionAnchors } from "./mention-html";

export type MentionDb = Pick<PrismaClient, "user" | "thinkpagesAccount">;

export interface MentionTarget {
  name: string;
  kind: "user" | "persona";
  /** The mentioned member's User.id (a handle). */
  userId: string | null;
  /** The owner's Clerk id (a persona): notices go to the owner, the title never names them. */
  ownerClerkId: string | null;
  href: string;
}

export async function resolveMentionNames(
  db: MentionDb,
  names: readonly string[]
): Promise<Map<string, MentionTarget>> {
  const found = new Map<string, MentionTarget>();
  const wanted = names.slice(0, MENTION_MAX_PER_POST);
  if (wanted.length === 0) return found;
  const [personas, users] = await Promise.all([
    db.thinkpagesAccount.findMany({
      where: {
        isActive: true,
        accountType: { not: PERSONAL_ACCOUNT_TYPE },
        OR: wanted.map((name) => ({ username: { equals: name, mode: "insensitive" as const } })),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { username: true, clerkUserId: true },
    }),
    db.user.findMany({
      where: { handle: { in: [...wanted] }, isActive: true },
      select: { id: true, handle: true },
    }),
  ]);
  // Personas that differ only by case share a name: the one spelled exactly as the (lower-case) name wins, else the
  // oldest (the rows come oldest first).
  for (const persona of personas) {
    const name = persona.username.toLowerCase();
    if (found.has(name) && persona.username !== name) continue;
    found.set(name, {
      name,
      kind: "persona",
      userId: null,
      ownerClerkId: persona.clerkUserId,
      href: personaProfileHref(persona.username),
    });
  }
  // A Passport handle wins a name that a persona also has.
  for (const user of users) {
    if (!user.handle) continue;
    found.set(user.handle, {
      name: user.handle,
      kind: "user",
      userId: user.id,
      ownerClerkId: null,
      href: handleProfileHref(user.handle),
    });
  }
  return found;
}

/**
 * The same sanitizer the body went through before, once more and last: a light-editor post or board message (no
 * `contentWikitext`) through `sanitizeUserContent`, a Canvas render through the wiki article sanitizer and the
 * positioning strip its pipeline ends with.
 */
function finalPass(html: string, canvas: boolean): string {
  return canvas ? stripPositioning(sanitizeWikiArticleHtml(html)) : sanitizeUserContent(html);
}

/**
 * `body` with its resolved mentions linked. Any mention link the body arrived with, forged or stored, is unwrapped
 * to its text first (only this function makes a mention link, and an edit keeps its mentions); nothing is queried without an `@`, and the same object comes back when
 * the body changed in no way. A body that changed is sanitized again, last, as `finalPass` says.
 */
export async function withMentionLinks<
  T extends { contentHtml: string; contentWikitext?: string | null },
>(db: MentionDb, body: T): Promise<T> {
  const clean = unwrapMentionAnchors(body.contentHtml);
  const names = mentionNamesInHtml(clean);
  const targets =
    names.length > 0 ? await resolveMentionNames(db, names) : new Map<string, MentionTarget>();
  const linked =
    targets.size > 0 ? linkMentionsInHtml(clean, (name) => targets.get(name)?.href ?? null) : clean;
  if (linked === body.contentHtml) return body;
  return { ...body, contentHtml: finalPass(linked, body.contentWikitext != null) };
}
