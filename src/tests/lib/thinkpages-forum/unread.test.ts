/** @jest-environment node */
import { isUnread, unreadFloor } from "~/lib/thinkpages-forum/unread";

const NOW = new Date("2026-10-15T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
describe("isUnread", () => {
  const floor = unreadFloor(NOW);

  it("never counts a thread whose last post is older than the window", () => {
    expect(isUnread(daysAgo(31), null, floor)).toBe(false);
  });
  it("treats a thread read up to its last post as read, and a later post as unread again", () => {
    expect(isUnread(daysAgo(1), daysAgo(1), floor)).toBe(false);
    expect(isUnread(daysAgo(1), daysAgo(2), floor)).toBe(true);
  });

  it("is not fooled by a read mark older than the floor", () => {
    expect(isUnread(daysAgo(10), daysAgo(40), floor)).toBe(true);
  });
});
