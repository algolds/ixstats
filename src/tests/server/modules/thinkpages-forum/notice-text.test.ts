/** @jest-environment node */
import {
  clip,
  memberName,
  noticeFor,
  type NoticeSubject,
} from "~/server/modules/thinkpages-forum/notice-text";
import {
  privacyConfigRow,
  privacyConnections,
  wikiAttributionOff,
} from "~/tests/helpers/privacy-config-fake";

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

type MemberRow = { handle: string | null; wikiUsername: string | null; clerkUserId: string };

function memberDb(row: MemberRow | null, connections = privacyConnections()) {
  return {
    user: { findUnique: jest.fn(async (_args: object): Promise<MemberRow | null> => row) },
    userConnection: connections,
  };
}

describe("memberName", () => {
  const wikiOnly: MemberRow = { handle: null, wikiUsername: "Wiki Name", clerkUserId: "c1" };

  it("names a member by their wiki name while they show wiki attribution", async () => {
    const on = privacyConnections([privacyConfigRow("c1", { showWikiAttribution: true })]);
    expect(await memberName(memberDb(wikiOnly, on) as never, "u1", "Member")).toBe("Wiki Name");
    expect(await memberName(memberDb(wikiOnly) as never, "u1", "Member")).toBe("Wiki Name");
  });

  it("gives the fallback instead of the wiki name with wiki attribution off", async () => {
    const off = privacyConnections(wikiAttributionOff("c1"));
    expect(await memberName(memberDb(wikiOnly, off) as never, "u1", "Member")).toBe("Member");
  });

  it("fails closed: a switch it cannot read gives the fallback", async () => {
    const broken = privacyConnections();
    broken.findMany.mockRejectedValue(new Error("db down"));
    expect(await memberName(memberDb(wikiOnly, broken) as never, "u1", "Member")).toBe("Member");
  });

  it("names a member by their handle without reading the switch", async () => {
    const off = privacyConnections(wikiAttributionOff("c1"));
    const db = memberDb({ ...wikiOnly, handle: "wikihandle" }, off);
    expect(await memberName(db as never, "u1", "Member")).toBe("wikihandle");
    expect(off.findMany).not.toHaveBeenCalled();
  });

  it("gives the fallback for a member it cannot find", async () => {
    expect(await memberName(memberDb(null) as never, "u9", "Member")).toBe("Member");
  });
});
