/** @jest-environment node */
import {
  capCount,
  countLabel,
  isUnread,
  NAV_COUNT_CAP,
  seenSince,
  UNREAD_WINDOW_MS,
  unreadFloor,
} from "~/lib/thinkpages-forum/unread";

const NOW = new Date("2026-10-15T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("unreadFloor", () => {
  it("is thirty days back", () => {
    expect(unreadFloor(NOW).getTime()).toBe(NOW.getTime() - UNREAD_WINDOW_MS);
    expect(unreadFloor(NOW)).toEqual(daysAgo(30));
  });
});

describe("seenSince", () => {
  const floor = daysAgo(10);

  it("is the floor when nothing was read or the read mark is older than the floor", () => {
    expect(seenSince(null, floor)).toBe(floor);
    expect(seenSince(undefined, floor)).toBe(floor);
    expect(seenSince(daysAgo(20), floor)).toBe(floor);
  });

  it("is the read time when it is later than the floor", () => {
    expect(seenSince(daysAgo(3), floor)).toEqual(daysAgo(3));
  });
});

describe("isUnread", () => {
  const floor = unreadFloor(NOW);

  it("never counts a thread whose last post is older than the window", () => {
    expect(isUnread(daysAgo(31), null, floor)).toBe(false);
  });

  it("counts a recent thread nobody opened", () => {
    expect(isUnread(daysAgo(1), null, floor)).toBe(true);
    expect(isUnread(daysAgo(1), undefined, floor)).toBe(true);
  });

  it("treats a thread read up to its last post as read, and a later post as unread again", () => {
    expect(isUnread(daysAgo(1), daysAgo(1), floor)).toBe(false);
    expect(isUnread(daysAgo(1), daysAgo(2), floor)).toBe(true);
  });

  it("is not fooled by a read mark older than the floor", () => {
    expect(isUnread(daysAgo(10), daysAgo(40), floor)).toBe(true);
  });

  it("hides what a later floor covers and shows what came after it", () => {
    const later = daysAgo(3);
    expect(isUnread(daysAgo(4), null, later)).toBe(false);
    expect(isUnread(daysAgo(2), null, later)).toBe(true);
  });
});

describe("sidebar counts", () => {
  it("clamps at one above the cap and labels it 99+", () => {
    expect(NAV_COUNT_CAP).toBe(99);
    expect(capCount(7)).toBe(7);
    expect(capCount(250)).toBe(100);
    expect(countLabel(99)).toBe("99");
    expect(countLabel(100)).toBe("99+");
  });
});
