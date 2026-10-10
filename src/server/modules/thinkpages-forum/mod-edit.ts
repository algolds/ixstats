/**
 * A moderator's edit of a post (phase 3). The body goes through `prepareBody` (sanitized last); a post in a submitted
 * or approved story chain is refused (P6, M17: hide it instead); the edit may keep or remove the author's action
 * links but never add one, since links belong to the author's nation. The write is conditional on the post being
 * unchanged since it was read (its `editedAt`), so a concurrent edit by the author is a CONFLICT, never overwritten.
 * A Canvas post loses its wikitext and template rows with the edit (it is HTML-only from then on). The edit, the
 * removal of dropped links and the log row (with the previous plain text, or for an image-only post
 * its images, M13) commit together.
 */
import { parseActionTokens } from "~/lib/action-links";
import { postSummary } from "~/lib/thinkpages-forum/post-summary";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import { contentModerator, loadPost, type ContentDb } from "./mod-content-target";
import { logModAction, modReason } from "./mod-log";
import { scopeOfCategory } from "./mod-scope";
import { inLockedChain, prepareBody } from "./writes";

/** A moderator edits the stored HTML, so a Canvas post becomes an HTML-only one: the stale cron must never re-render its old wikitext over the edit. */
const HTML_ONLY = { contentWikitext: null, rendererVersion: null, renderedAt: null };

export async function modEditPost(
  db: ContentDb,
  actor: ForumViewer,
  input: { postId: string; html: string; note: string }
): Promise<void> {
  const note = modReason(input.note);
  const post = await loadPost(db, input.postId);
  const { category } = post.thread;
  const moderator = await contentModerator(db, actor, category, post.authorUserId);
  const body = prepareBody(input.html);
  const before = new Set(parseActionTokens(post.plainText));
  const tokens = parseActionTokens(body.plainText);
  if (tokens.some((id) => !before.has(id))) {
    throw new ForumError("BAD_REQUEST", "A moderator edit can't add action links.");
  }
  if (await inLockedChain(db, post.id)) {
    throw new ForumError(
      "CONFLICT",
      "This post is part of a submitted story chain. Hide it instead."
    );
  }
  await db.$transaction(async (tx) => {
    const { count } = await tx.forumPost.updateMany({
      where: { id: post.id, editedAt: post.editedAt },
      data: { ...body, ...HTML_ONLY, editedAt: new Date() },
    });
    if (count === 0) throw new ForumError("CONFLICT", "This post was edited meanwhile. Reload it.");
    await tx.forumPostTemplate.deleteMany({ where: { postId: post.id } });
    await tx.postActionLink.deleteMany({
      where: { postSource: "native", postRef: post.id, activityId: { notIn: tokens } },
    });
    await logModAction(tx, {
      actorId: moderator.id,
      action: "post.edit",
      targetType: "post",
      targetId: post.id,
      scope: scopeOfCategory(category),
      detail: { note, previous: postSummary(post) },
    });
  });
}
