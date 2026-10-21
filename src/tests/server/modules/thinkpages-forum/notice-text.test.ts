/** @jest-environment node */
import {
  clip,
  memberName,
  noticeFor,
  type NoticeSubject,
} from "~/server/modules/thinkpages-forum/notice-text";
import { privacyConnections, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

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
  it("gives the fallback instead of the wiki name with wiki attribution off", async () => {
    const off = privacyConnections(wikiAttributionOff("c1"));
    expect(await memberName(memberDb(wikiOnly, off) as never, "u1", "Member")).toBe("Member");
  });

  it("fails closed: a switch it cannot read gives the fallback", async () => {
    const broken = privacyConnections();
    broken.findMany.mockRejectedValue(new Error("db down"));
    expect(await memberName(memberDb(wikiOnly, broken) as never, "u1", "Member")).toBe("Member");
  });
});
