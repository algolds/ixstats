/** @jest-environment node */
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { createMany: jest.fn() } }));
jest.mock("~/lib/notifications/guard", () => ({ isNotificationEventEnabled: jest.fn() }));

import { notificationAPI } from "~/lib/notifications/api";
import { isNotificationEventEnabled } from "~/lib/notifications/guard";
import {
  sendForumNotices,
  type ForumNotice,
} from "~/server/modules/thinkpages-forum/forum-notices";

const createMany = jest.mocked(notificationAPI.createMany);
const enabled = jest.mocked(isNotificationEventEnabled);

const notice = (n: number): ForumNotice => ({
  clerkUserId: `clerk_${n}`,
  title: "Kir mentioned you in Trade talks",
  message: "hello",
  href: "/thinkpages/post/p1",
  priority: "medium",
  metadata: { kind: "mention", postId: "p1", threadId: "t1" },
});

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  createMany.mockReset();
  createMany.mockResolvedValue([]);
  enabled.mockReset();
  enabled.mockResolvedValue(true);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe("sendForumNotices", () => {
  it("writes social notices from the forum source, with a plain href and the priority given", async () => {
    await expect(sendForumNotices([notice(1)])).resolves.toBe(true);
    expect(createMany).toHaveBeenCalledWith([
      {
        userId: "clerk_1",
        title: "Kir mentioned you in Trade talks",
        message: "hello",
        href: "/thinkpages/post/p1",
        category: "social",
        priority: "medium",
        source: "thinkpages-forum",
        metadata: { kind: "mention", postId: "p1", threadId: "t1" },
      },
    ]);
  });

  it("checks the admin switch itself, since createMany has no guard, and writes nothing when it is off", async () => {
    enabled.mockResolvedValue(false);
    await expect(sendForumNotices([notice(1)])).resolves.toBe(true);
    expect(enabled).toHaveBeenCalledWith("thinkpages-forumNotification");
    expect(createMany).not.toHaveBeenCalled();
  });

  it("reports a failed write instead of throwing", async () => {
    createMany.mockRejectedValue(new Error("db down"));
    await expect(sendForumNotices([notice(1)])).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("does nothing for no notices, and writes a large batch in chunks of 500", async () => {
    await expect(sendForumNotices([])).resolves.toBe(true);
    expect(enabled).not.toHaveBeenCalled();
    await sendForumNotices(Array.from({ length: 1200 }, (_, i) => notice(i)));
    expect(createMany.mock.calls.map(([batch]) => batch.length)).toEqual([500, 500, 200]);
  });
});
