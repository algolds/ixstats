/** @jest-environment node */
/**
 * P4: callers may hand `notificationAPI.create` a plain app path (the follow notification's `/dashboard/profile/<u>`)
 * or one already under the base path (`trigger` applies `withBasePath` itself). Either way the stored href carries
 * the base path exactly once, and absolute URLs pass through.
 */
jest.mock("~/server/db", () => ({ db: { notification: { create: jest.fn() } } }));
jest.mock("~/lib/notifications/guard", () => ({
  isNotificationEventEnabled: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("~/lib/notifications/recipient-preferences", () => ({
  recipientAccepts: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("~/lib/notifications/delivery/deliver", () => ({ deliverNotification: jest.fn() }));

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { notificationAPI } from "~/lib/notifications/api";
import { db } from "~/server/db";

const create = jest.mocked(db.notification.create);
const previous = process.env.BASE_PATH;

beforeAll(() => {
  process.env.BASE_PATH = "/projects/ixstates";
});
afterAll(() => {
  process.env.BASE_PATH = previous;
});
beforeEach(() => {
  create.mockReset();
  create.mockImplementation(((args: { data: { title: string } }) =>
    Promise.resolve({ id: "n1", userId: null, ...args.data })) as never);
});

const storedHref = async (href: string) => {
  await notificationAPI.create({ title: "New follower", userId: null, href });
  return (create.mock.calls[0]![0] as { data: { href: string | null } }).data.href;
};

describe("notification hrefs", () => {
  it.each([
    ["a plain app path", "/dashboard/profile/jane", "/projects/ixstates/dashboard/profile/jane"],
    [
      "a path already under the base path",
      "/projects/ixstates/dashboard/post/p1",
      "/projects/ixstates/dashboard/post/p1",
    ],
    ["an absolute URL", "https://ixwiki.com/wiki/Main_Page", "https://ixwiki.com/wiki/Main_Page"],
  ])("stores %s with the base path once", async (_name, href, stored) => {
    await expect(storedHref(href)).resolves.toBe(stored);
  });
});
