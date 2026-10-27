/** @jest-environment node */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { postBotCommand } from "~/lib/ixtime/bot-control";

function stubFetch(status: number, message?: string) {
  return jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ message }), { status }));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("postBotCommand", () => {
  it("posts the override with its body and returns the bot's message", async () => {
    const fetchMock = stubFetch(200, "Override set");
    const result = await postBotCommand("http://bot", "override", "set bot time override", {
      ixTimeMs: 42,
      multiplier: 2,
    });
    expect(result).toEqual({ success: true, message: "Override set" });
    const [url, init = {}] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://bot/ixtime/override");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ ixTimeMs: 42, multiplier: 2 }));
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends no body for a bare command", async () => {
    const fetchMock = stubFetch(200, "Paused");
    expect(await postBotCommand("http://bot", "pause", "pause bot time")).toEqual({
      success: true,
      message: "Paused",
    });
    const [url, init = {}] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://bot/ixtime/pause");
    expect("body" in init).toBe(false);
  });

  it("names the action and the status when the bot refuses", async () => {
    stubFetch(503);
    expect(await postBotCommand("http://bot", "resume", "resume bot time")).toEqual({
      success: false,
      message: "Failed to resume bot time: Bot API returned 503",
    });
  });

  it("never throws when the request fails", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("offline"));
    expect(await postBotCommand("http://bot", "clear", "clear bot overrides")).toEqual({
      success: false,
      message: "Failed to clear bot overrides: offline",
    });
    jest.spyOn(global, "fetch").mockRejectedValueOnce("boom");
    expect(await postBotCommand("http://bot", "clear", "clear bot overrides")).toEqual({
      success: false,
      message: "Failed to clear bot overrides: Unknown error",
    });
  });
});
