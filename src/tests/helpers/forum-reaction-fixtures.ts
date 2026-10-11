/**
 * Forum rows for the reaction suites, on top of the realm board store: a sitewide thread, Eurth Hub threads (open,
 * locked, archived, hidden), threads in the archived Old realm and the hidden Draft realm, and board messages. Every
 * post is by u_member2 unless its id says otherwise. Eurth's Hub is public; u_member owns a nation in Eurth, u_visitor
 * owns one in Aurora, u_plain has none.
 */
import {
  at,
  BOARD_THREAD,
  boardPost,
  boardStore,
  seed,
  type BoardStore,
} from "~/tests/helpers/forum-board-fake";
import type { Row } from "~/tests/helpers/forum-store-fake";

export const SITE_CATEGORY: Row = {
  id: "cat_site_general",
  scope: "site",
  realmId: null,
  key: "general",
  name: "General",
  visibility: "public",
  postRole: "any",
  icAllowed: false,
  style: "ooc",
};

const thread = (id: string, categoryId: string, extra: Row = {}): Row => ({
  id,
  categoryId,
  title: `Thread ${id}`,
  authorUserId: "u_member2",
  authorPersonaId: null,
  importedAuthorName: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
  postCount: 1,
  lastPostAt: at(1),
  createdAt: at(1),
  ...extra,
});

const post = (id: string, threadId: string, extra: Row = {}): Row =>
  boardPost(id, 1, {
    threadId,
    authorUserId: "u_member2",
    reactionCounts: {},
    sourceRef: null,
    ...extra,
  });

export function reactionStore(): BoardStore {
  const base = seed();
  return boardStore({
    ...base,
    categories: [...(base.categories ?? []), SITE_CATEGORY],
    threads: [
      ...(base.threads ?? []),
      thread("t_site", "cat_site_general"),
      thread("t_hub", "cat_r_eurth_hub"),
      thread("t_locked", "cat_r_eurth_hub", { locked: true }),
      thread("t_archived", "cat_r_eurth_hub", { archived: true }),
      thread("t_hidden", "cat_r_eurth_hub", { hidden: true }),
      thread("t_old", "cat_r_old_hub"),
      thread("t_draft", "cat_r_draft_hub"),
    ],
    posts: [
      post("p_site", "t_site"),
      post("p_hub", "t_hub"),
      post("p_mine", "t_hub", { authorUserId: "u_member" }),
      post("p_persona", "t_hub", { authorUserId: "u_visitor", authorPersonaId: "pa_visitor" }),
      post("p_hidden", "t_hub", { hidden: true }),
      post("p_import", "t_hub", { authorUserId: null, importedAuthorName: "OldUser" }),
      post("p_locked", "t_locked"),
      post("p_archived", "t_archived"),
      post("p_hiddenthread", "t_hidden"),
      post("p_old", "t_old"),
      post("p_draft", "t_draft"),
      post("b1", BOARD_THREAD),
      post("b_mine", BOARD_THREAD, { authorUserId: "u_member" }),
      post("b_hidden", BOARD_THREAD, { hidden: true }),
      post("b_continued", BOARD_THREAD, { continuedThreadId: "t_hub" }),
      post("b_old", "t_board_r_old"),
      post("b_draft", "t_board_r_draft"),
    ],
  });
}
