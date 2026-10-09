/** @jest-environment node */
import {
  attachmentsByPost,
  emptyRehide,
  planRehide,
  type RehideDbState,
} from "~/lib/thinkpages-forum/import/rehide";
import type { XfPost, XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";

const thread = (discussion_state = "visible"): XfThread => ({
  thread_id: 1,
  node_id: 12,
  title: "T",
  user_id: 7,
  username: "Admin",
  post_date: 1700000000,
  last_post_date: 1700000000,
  reply_count: 2,
  view_count: 0,
  first_post_id: 10,
  discussion_open: true,
  sticky: false,
  discussion_state,
  prefix_id: 0,
});

const post = (post_id: number, position: number, message_state = "visible"): XfPost => ({
  post_id,
  thread_id: 1,
  user_id: 7,
  username: "Admin",
  post_date: 1700000000 + position,
  message: "x",
  message_state,
  position,
  attach_count: 0,
  is_first_post: position === 0,
});

const db = (extra: Partial<RehideDbState> = {}): RehideDbState => ({
  existingPosts: new Set([10, 11, 12]),
  hiddenThreads: new Set(),
  hiddenPosts: new Set(),
  ...extra,
});

const ATTACHMENTS = new Map([
  [10, [100]],
  [11, [110]],
  [12, [120, 121]],
]);

function plan(t: XfThread, posts: XfPost[], state = db(), existingId: string | null = "t1") {
  const out = emptyRehide();
  planRehide(out, { thread: t, posts, existingId, db: state, attachments: ATTACHMENTS });
  return out;
}

describe("planRehide (I7)", () => {
  it("plans nothing for a thread never imported, or with nothing withdrawn", () => {
    expect(plan(thread("deleted"), [post(10, 0)], db(), null)).toEqual(emptyRehide());
    expect(plan(thread(), [post(10, 0), post(11, 1)])).toEqual(emptyRehide());
  });

  it.each([
    ["the thread is now moderated", thread("moderated"), "visible"],
    ["the thread is now deleted", thread("deleted"), "visible"],
    ["its first post is now moderated", thread(), "moderated"],
    ["its first post is now deleted", thread(), "deleted"],
  ])("hides the thread when %s, restricting every post's attachments", (_, t, firstState) => {
    expect(plan(t, [post(10, 0, firstState), post(11, 1), post(12, 2)])).toEqual({
      threads: [{ threadId: "t1", xenforoThreadId: 1, thread: true, posts: [] }],
      attachmentIds: [100, 110, 120, 121],
    });
  });

  it("hides imported replies now moderated or deleted, never the first post alone", () => {
    expect(
      plan(thread(), [
        post(10, 0),
        post(11, 1, "moderated"),
        post(12, 2, "deleted"),
        post(13, 3, "deleted"),
      ])
    ).toEqual({
      threads: [{ threadId: "t1", xenforoThreadId: 1, thread: false, posts: [11, 12] }],
      attachmentIds: [110, 120, 121],
    });
  });

  it("leaves out rows the database already holds hidden, so a rerun plans nothing", () => {
    const hidden = db({ hiddenThreads: new Set([1]), hiddenPosts: new Set([11]) });
    expect(plan(thread("moderated"), [post(10, 0), post(11, 1, "deleted")], hidden)).toEqual(
      emptyRehide()
    );
    expect(
      plan(
        thread("moderated"),
        [post(10, 0), post(11, 1, "deleted"), post(12, 2, "moderated")],
        hidden
      )
    ).toEqual({
      threads: [{ threadId: "t1", xenforoThreadId: 1, thread: false, posts: [12] }],
      attachmentIds: [120, 121],
    });
  });
});

describe("attachmentsByPost", () => {
  it("joins a post's own attachments and the snapshot's entries, each id once", () => {
    const withList: XfPost = {
      ...post(10, 0),
      Attachments: [
        { attachment_id: 5, filename: "a.png", file_size: 1, content_type: "image/png" },
      ],
    };
    const map = attachmentsByPost(
      [withList, post(11, 1)],
      [
        { attachment_id: 5, post_id: 10 },
        { attachment_id: 6, post_id: 10 },
        { attachment_id: 7, post_id: 12 },
      ]
    );
    expect(Object.fromEntries(map)).toEqual({ 10: [5, 6], 12: [7] });
  });
});
