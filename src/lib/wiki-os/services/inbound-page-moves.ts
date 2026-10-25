/**
 * inbound-page-moves.ts — a classic MediaWiki move applied to WikiOS: the article is renamed (its revisions, categories
 * and watchers stay attached), its protections go with it, and the redirect MediaWiki left is brought over.
 *
 * A classic move of a page WikiOS moved too, its move one the classic mover never saw (owed to MediaWiki, held back by
 * the mirror because the classic move beat it, or sent after the classic move happened), goes through the conflict rule:
 * the later move wins. A redirect WikiOS's losing moves left behind is archived with them, so no WikiOS redirect points
 * at a page that is gone. Callers hold the inbound-sync lock (inbound-log-events.ts applies the event).
 */
import { toArticleSlug } from "../core/domain-types";
import { canonicalizeTitle, type CanonicalTitle } from "../core/title";
import {
  CLASSIC_MOVE_ACTIONS,
  classicMoveTarget,
  contestingWikiosMove,
  moveChain,
  wikiosMovesSince,
  type WikiosMove,
} from "./conflict-page-ops";
import {
  collide,
  IGNORED,
  keepWikios,
  pageManagement,
  recordVerdict,
  SKIPPED,
  SOURCE,
  type Applied,
  type EventContext,
  type JudgedPage,
  type Tx,
} from "./inbound-event-rule";
import type { LogEvent } from "./inbound-mediawiki";
import { evictCaches, syncLatestRevision } from "./inbound-revision-sync";
import { enqueueRender, invalidateTemplateDependents } from "./render-service";

/** MediaWiki's `target_title` of a move, canonical; null when it is absent or not a title. */
function moveTarget(event: LogEvent): CanonicalTitle | null {
  const title = classicMoveTarget(event);
  return title ? canonicalizeTitle(title) : null;
}

/** Whether MediaWiki left a redirect at the old title (`suppressredirect` is present when it did not). */
function leftRedirect(event: LogEvent): boolean {
  return !("suppressredirect" in event.params) || event.params.suppressredirect === false;
}

/** Import what MediaWiki has at `title` (the redirect a move left). */
async function bringOver(title: string): Promise<void> {
  await syncLatestRevision(title);
}

/**
 * Archive the redirects WikiOS's move `move` and the moves built on it left behind (each at its old title, pointing at
 * its new one): the moves lost, so they point at a name the page no longer has. Returns the titles they were at.
 */
export async function archiveMoveRedirects(tx: Tx, move: WikiosMove): Promise<string[]> {
  const later = await wikiosMovesSince(move.articleId, move.change.at);
  const chain = [move, ...later.filter((each) => each.change.ref !== move.change.ref)];
  for (const { from, to } of chain) {
    await tx.wikiArticle.updateMany({
      where: { source: SOURCE, title: from, redirectTargetSlug: to, status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", htmlSyncedAt: null },
    });
  }
  return chain.map(({ from }) => from);
}

/**
 * Free `target` for the moved page: the page that sits there is deleted in MediaWiki (a title swap, the
 * move over a redirect), so WikiOS archives it and renames it out of the way, keeping its revisions and
 * watchers (nothing is deleted); it stays ARCHIVED under an internal title naming the log event. A page
 * that is neither deleted nor a redirect is a real clash, and false.
 */
async function archiveOutOfTheWay(
  tx: Tx,
  clash: { id: string; status: string; redirectTargetSlug: string | null },
  target: CanonicalTitle,
  logid: number
): Promise<boolean> {
  if (clash.status !== "ARCHIVED" && clash.redirectTargetSlug === null) return false;
  const title = `${target.title} (deleted ${logid})`;
  await tx.wikiArticle.update({
    where: { id: clash.id },
    data: { title, slug: toArticleSlug(title), status: "ARCHIVED", htmlSyncedAt: null },
  });
  return true;
}

/**
 * Rename `page` to `target`, its protections with it, after freeing the title (`archiveOutOfTheWay`). Returns the page
 * that was moved out of the way, if any; null when a page WikiOS has holds the title (nothing is renamed).
 */
async function renameTo(
  tx: Tx,
  page: JudgedPage,
  target: CanonicalTitle,
  logid: number
): Promise<{ clash: { id: string } | null } | null> {
  const clash = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: target.title } },
    select: { id: true, status: true, redirectTargetSlug: true },
  });
  if (clash && !(await archiveOutOfTheWay(tx, clash, target, logid))) {
    console.warn(
      `[WikiAutoSync] Not renaming "${page.title}": "${target.title}" exists in WikiOS.`
    );
    return null;
  }

  const { legacyProtectionLevel, PageManagementService } = await pageManagement();
  const edit = await PageManagementService.moveRestrictions(tx, SOURCE, page.title, target.title);
  await tx.wikiArticle.update({
    where: { id: page.id },
    data: {
      title: target.title,
      slug: target.slug,
      namespace: target.namespaceId,
      namespacePrefix: target.namespacePrefix,
      protectionLevel: legacyProtectionLevel(edit?.level),
      protectionExpiry: edit?.expiresAt ?? null,
      // The page's name is part of how it renders ({{PAGENAME}}, the display title): stale.
      htmlSyncedAt: null,
    },
  });
  return { clash };
}

/**
 * A page renamed from the event's title `from` to `target`: what follows once the move is committed. `elsewhere`: the
 * other titles the page or WikiOS's redirects had, when a classic move won over WikiOS's moves.
 */
function renamed(
  event: LogEvent,
  movedId: string,
  from: string,
  target: CanonicalTitle,
  clash: { id: string } | null,
  elsewhere: readonly string[] = []
): Applied {
  const oldTitles = [...new Set([from, ...elsewhere])];
  return {
    outcome: "applied",
    articleId: movedId,
    afterCommit: async () => {
      enqueueRender(movedId, { background: true });
      // MediaWiki left a redirect at the old title: that page is new to WikiOS.
      if (leftRedirect(event)) await bringOver(from);
      for (const title of oldTitles) await evictCaches(title, movedId);
      await evictCaches(target.title, movedId);
      if (clash) await evictCaches(target.title, clash.id);
      // A moved template or module: its users render with the new name, or find the old one a redirect.
      for (const title of oldTitles) void invalidateTemplateDependents(title);
      void invalidateTemplateDependents(target.title);
    },
  };
}

/**
 * A classic move of a page WikiOS moved elsewhere, a move the classic mover never saw: the later move wins. A classic
 * move that wins renames the page from where WikiOS put it, and the redirects WikiOS's moves left (pointing at names
 * the page no longer has) go, so MediaWiki's redirect is brought over in their place; one that loses leaves the page
 * where WikiOS has it. WikiOS's move stands with the moves built on it, and they lose together.
 */
async function applyContestedMove(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  target: CanonicalTitle,
  wikios: WikiosMove
): Promise<Applied> {
  const page = await tx.wikiArticle.findUnique({
    where: { id: wikios.articleId },
    select: { id: true, title: true },
  });
  if (!page) return SKIPPED;
  const verdict = await collide(event, "move", page.id, wikios.change, await moveChain(wikios));
  if (!verdict.incomingWins) return keepWikios(tx, page, verdict);

  // an event applied again finds the page already at its new name
  const moved =
    page.title === target.title ? { clash: null } : await renameTo(tx, page, target, event.logid);
  if (!moved) return SKIPPED;
  const redirects = await archiveMoveRedirects(tx, wikios);
  await recordVerdict(tx, { id: page.id, title: target.title }, verdict);
  return renamed(event, page.id, canon.title, target, moved.clash, [page.title, ...redirects]);
}

/** A classic move of a page WikiOS never moved (or already at its new name): renamed as MediaWiki has it. */
async function applyPlainMove(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  target: CanonicalTitle
): Promise<Applied> {
  const moved = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true },
  });
  if (!moved) {
    // A page WikiOS never held, or one already at its new name (an earlier try renamed it): nothing to rename; the
    // redirect MediaWiki left is still to be brought over.
    const already = await tx.wikiArticle.findUnique({
      where: { source_title: { source: SOURCE, title: target.title } },
      select: { id: true },
    });
    return {
      outcome: "applied",
      articleId: already?.id ?? null,
      afterCommit: already && leftRedirect(event) ? () => bringOver(canon.title) : undefined,
    };
  }

  const result = await renameTo(tx, { id: moved.id, title: canon.title }, target, event.logid);
  if (!result) return SKIPPED;
  return renamed(event, moved.id, canon.title, target, result.clash);
}

export async function applyMove(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  if (!CLASSIC_MOVE_ACTIONS.has(event.action)) return IGNORED;
  // A `File:` page that moves in MediaWiki is renamed here like any page, but its `wiki_assets` row (name, hash key,
  // slug, URL) is NOT re-keyed in v1: the asset keeps its old name until it is registered again under the new one.
  // (WikiOS refuses to move files itself; both are post-v1, see the follow-ups, F37.)
  const target = moveTarget(event);
  if (!canon || !target) return SKIPPED;

  const wikios = await contestingWikiosMove(canon.title, event);
  if (wikios?.to === target.title) {
    // WikiOS moved the page to the same title: both wikis agree, and there is nothing to rename
    return {
      outcome: "applied",
      articleId: wikios.articleId,
      afterCommit: leftRedirect(event) ? () => bringOver(canon.title) : undefined,
    };
  }
  if (wikios) return applyContestedMove(tx, event, canon, target, wikios);
  return applyPlainMove(tx, event, canon, target);
}
