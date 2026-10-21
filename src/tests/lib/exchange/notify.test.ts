/**
 * Exchange notifications go through the shared notification API (which applies the
 * recipient's preferences), as "economic" notices, and never throw into a settled move.
 */
const create = jest.fn();
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create } }));

import { sendExchangeNotices } from "~/lib/exchange/notify";

beforeEach(() => {
  create.mockReset();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("sendExchangeNotices", () => {
  it("swallows delivery failures", async () => {
    create.mockRejectedValue(new Error("suppressed"));
    await expect(sendExchangeNotices([{ userId: "u1", title: "a", message: "b" }])).resolves.toBe(
      0
    );
  });
});
