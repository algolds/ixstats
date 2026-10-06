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
  it("addresses each recipient as an economic notice linking to the Exchange", async () => {
    create.mockResolvedValue("n1");
    const sent = await sendExchangeNotices([
      { userId: "u1", title: "Dividend from X", message: "₷5 is in your wallet." },
      { userId: "u2", title: "You won Y", message: "Awarded", priority: "high" },
    ]);
    expect(sent).toBe(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        category: "economic",
        priority: "medium",
        href: "/vault/exchange",
        source: "exchange",
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2", priority: "high" })
    );
  });

  it("counts a notice the recipient's preferences filtered out as not sent", async () => {
    create.mockResolvedValueOnce("").mockResolvedValueOnce("n2");
    const sent = await sendExchangeNotices([
      { userId: "muted", title: "a", message: "b" },
      { userId: "u2", title: "c", message: "d" },
    ]);
    expect(sent).toBe(1);
  });

  it("swallows delivery failures", async () => {
    create.mockRejectedValue(new Error("suppressed"));
    await expect(sendExchangeNotices([{ userId: "u1", title: "a", message: "b" }])).resolves.toBe(
      0
    );
  });
});
