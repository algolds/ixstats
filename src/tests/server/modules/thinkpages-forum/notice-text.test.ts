/** @jest-environment node */
import { clip, noticeFor, type NoticeSubject } from "~/server/modules/thinkpages-forum/notice-text";

const subject = (over: Partial<NoticeSubject> = {}): NoticeSubject => ({
  postId: "p1",
  threadId: "t1",
  threadTitle: "Trade talks",
  name: "Aria Vance",
  excerpt: "hello",
  realmName: "Eurth",
  board: false,
  ...over,
});

describe("noticeFor", () => {
  it("words each kind, medium priority for a person's action and low for a watched thread", () => {
    expect(noticeFor("mention", subject(), "c").title).toBe(
      "Aria Vance mentioned you in Trade talks"
    );
    expect(noticeFor("quote", subject(), "c").title).toBe(
      "Aria Vance quoted your post in Trade talks"
    );
    expect(noticeFor("reply", subject(), "c").title).toBe(
      "Aria Vance replied to you on the Eurth board"
    );
    expect(noticeFor("watch", subject(), "c")).toEqual({
      clerkUserId: "c",
      title: "New reply in Trade talks",
      message: "Aria Vance: hello",
      href: "/thinkpages/post/p1",
      priority: "low",
      metadata: { kind: "watch", postId: "p1", threadId: "t1" },
    });
    expect(noticeFor("mention", subject(), "c").priority).toBe("medium");
  });

  it("words a reaction at low priority, naming the reactor, with its dedupe key", () => {
    expect(noticeFor("reaction", subject({ name: "member", reactionKey: "p1:u9" }), "c")).toEqual({
      clerkUserId: "c",
      title: "member reacted to your post in Trade talks",
      message: "hello",
      href: "/thinkpages/post/p1",
      priority: "low",
      metadata: { kind: "reaction", postId: "p1", threadId: "t1", reactionKey: "p1:u9" },
    });
    expect(noticeFor("reaction", subject({ board: true }), "c").title).toBe(
      "Aria Vance reacted to your post in the Eurth board"
    );
  });

  it("names the realm board instead of the thread on the board", () => {
    expect(noticeFor("mention", subject({ board: true }), "c").title).toBe(
      "Aria Vance mentioned you in the Eurth board"
    );
  });

  it("clips a long title to 200 characters with an ellipsis", () => {
    expect(clip("x".repeat(200))).toHaveLength(200);
    const clipped = clip("x".repeat(201));
    expect(clipped).toHaveLength(200);
    expect(clipped.endsWith("…")).toBe(true);
    expect(noticeFor("watch", subject({ threadTitle: "y".repeat(500) }), "c").title).toHaveLength(
      200
    );
  });
});
