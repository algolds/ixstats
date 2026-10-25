/**
 * mirror-classic-location.ts — where classic MediaWiki has a page WikiOS mirrors, when the two wikis name it differently
 * for a while: classic moved it and WikiOS has not applied that move yet, or WikiOS moved it and MediaWiki has not had
 * that move yet. The mirror sends each write to where classic has the page, never to a title that only one wiki uses.
 *
 * A page is followed by its MediaWiki page id (the one the move log names), so an unrelated page someone made at a title
 * the page passed through is never taken for it.
 */
import { db } from "~/server/db";
import { CLASSIC_MOVE_ACTIONS, classicMoveTarget } from "./conflict-page-ops";
import { operationChanges } from "./conflict-sides";
import { classicPage, latestClassicEvent, recentHistory, stampedIn } from "./mirror-history";

/** The most moves followed to find where classic has a page now. */
const MAX_MOVE_HOPS = 5;

/** Where a page was looked for: found there, or not found, `title` being the last title tried. */
export interface ClassicLocation {
  title: string;
  found: boolean;
  /** Not found, and another page holds `title`: never one to act on. */
  heldByAnother: boolean;
}

/**
 * Where classic has the page with id `pageId` (any page there when null; or a page `isOurs` says is the page's own),
 * starting at `title`: there or at the end of its redirect, or where classic's moves took it from there (a few of them).
 */
export async function findClassicPage(
  title: string,
  pageId: number | null,
  isOurs?: (title: string) => Promise<boolean>
): Promise<ClassicLocation> {
  let at = title;
  let occupied = false;
  for (let hop = 0; hop < MAX_MOVE_HOPS; hop++) {
    const page = await classicPage(at, true);
    const ours = page.exists && (pageId === null || page.pageId === pageId);
    // a title with no page has no history: `isOurs` never holds there
    if (ours || (isOurs && (await isOurs(page.title)))) {
      return { title: page.title, found: true, heldByAnother: false };
    }
    occupied = page.exists;
    const moved = await latestClassicEvent(at, "move", CLASSIC_MOVE_ACTIONS);
    const next = moved ? classicMoveTarget(moved) : null;
    if (!next) break;
    at = next;
  }
  return { title: at, found: false, heldByAnother: occupied };
}

/**
 * Whether the classic page at a title holds a revision the article has (stamped with its MediaWiki id): the article's
 * own page under a new page id, such as one a WikiOS save brought back after a delete. As `findClassicPage`'s `isOurs`.
 */
export function holdsRevisionOf(articleId: string): (title: string) => Promise<boolean> {
  return async (title) => {
    const history = await recentHistory(title);
    const stamped = await stampedIn(
      articleId,
      history.map((entry) => entry.revid)
    );
    return stamped.size > 0;
  };
}

/** The error of a job that would have to act on a page that is not its own: an administrator looks at it. */
export function heldByAnotherError(location: ClassicLocation, title: string): Error {
  return new Error(
    `An unrelated page now holds "${location.title}" in classic MediaWiki, where the page of "${title}" was last`
  );
}

/**
 * The title an article's revisions go to in classic MediaWiki: where classic has the article's page (by its MediaWiki
 * page id), starting from where WikiOS has it now (a classic move the cycle applied renamed it) or, while a WikiOS move
 * of it is owed to MediaWiki, from the title that move goes from. That follows a classic move WikiOS has not applied
 * yet. A page WikiOS knows no MediaWiki id of goes to that title; `queuedAs`, the job's own, for a job with no article.
 */
export async function classicTitleOf(articleId: string | null, queuedAs: string): Promise<string> {
  if (!articleId) return queuedAs;
  const [owed] = await operationChanges({ articleId, kind: "move" });
  const article = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { title: true, mwPageId: true },
  });
  const title = owed?.job.title ?? article?.title ?? queuedAs;
  if (!article?.mwPageId) return title;
  // not found: the title the page was last at in classic, where a delete there is judged; never another page's
  const location = await findClassicPage(title, article.mwPageId, holdsRevisionOf(articleId));
  if (location.heldByAnother) throw heldByAnotherError(location, title);
  return location.title;
}
