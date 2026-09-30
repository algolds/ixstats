/** @jest-environment node */
/**
 * onSocialActivity (mention / repost / quote) links to the real post route and names the actor;
 * ThinkPage activity notifications name the actor when one is given.
 */
const mockCreate = jest.fn();
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/notifications/guard", () => ({
  guardNotificationEvent: jest.fn().mockResolvedValue(true),
  isNotificationEventEnabled: jest.fn().mockResolvedValue(true),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { notificationAPI } from "~/lib/notifications/api";
import { onSocialActivity } from "~/lib/notifications/hooks";

beforeEach(() => {
  mockCreate.mockReset().mockResolvedValue("n1");
  jest.spyOn(notificationAPI, "create").mockImplementation(mockCreate as never);
});

describe("onSocialActivity", () => {
  it("links a mention to /thinkpages/post/<id> and names the actor persona", async () => {
    await onSocialActivity({
      activityType: "mention",
      fromUserId: "clerk_a",
      fromUserName: "The Chancellor",
      toUserId: "clerk_b",
      contentTitle: "hello",
      contentId: "post_1",
    });
    const input = mockCreate.mock.calls[0]![0];
    expect(input.href).toMatch(/\/thinkpages\/post\/post_1$/);
    expect(input.href).not.toContain("/content/");
    expect(input.title).toBe("The Chancellor mentioned you");
    expect(input.userId).toBe("clerk_b");
    expect(input.metadata).toMatchObject({ postId: "post_1", activityType: "mention" });
  });

  it("has repost and quote wording", async () => {
    await onSocialActivity({
      activityType: "repost",
      fromUserId: "a",
      fromUserName: "Ann",
      toUserId: "b",
      contentId: "p",
    });
    await onSocialActivity({
      activityType: "quote",
      fromUserId: "a",
      fromUserName: "Ann",
      toUserId: "b",
      contentId: "p",
    });
    expect(mockCreate.mock.calls[0]![0].title).toBe("Ann reposted your post");
    expect(mockCreate.mock.calls[1]![0].title).toBe("Ann quoted your post");
  });

  it("has no link at all rather than a broken one when there is no post", async () => {
    await onSocialActivity({ activityType: "follow", fromUserId: "a", toUserId: "b" });
    const input = mockCreate.mock.calls[0]![0];
    expect(input.href).toBeNull();
    expect(input.title).toBe("Someone started following you");
  });
});

describe("ThinkPage activity title", () => {
  it("names the actor when authorName is given", async () => {
    await notificationAPI.trigger({
      thinkpage: {
        id: "p9",
        title: "nice post",
        action: "liked",
        authorId: "a",
        authorName: "Ann",
        targetUserId: "u",
      },
    });
    expect(mockCreate.mock.calls[0]![0]).toMatchObject({
      title: "Ann liked your ThinkPage",
      message: '"nice post"',
      userId: "u",
    });
  });
});
