/** @jest-environment node */
import { sendAdminDm } from "~/lib/discord/admin-dm";

const fetchMock = jest.fn();
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  env = { ...process.env };
  global.fetch = fetchMock as never;
  fetchMock.mockReset();
});
afterEach(() => {
  process.env = env;
});

describe("sendAdminDm", () => {
  it("does nothing without a bot token", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    await sendAdminDm("hi");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens a DM with the admin, then posts the message", async () => {
    process.env.DISCORD_BOT_TOKEN = "t0k";
    delete process.env.DISCORD_ADMIN_USER_ID;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "chan1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await sendAdminDm("WikiOS editing turned on by Admin");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://discord.com/api/v10/users/@me/channels",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bot t0k" }),
        body: JSON.stringify({ recipient_id: "156198941879304192" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://discord.com/api/v10/channels/chan1/messages",
      expect.objectContaining({ body: JSON.stringify({ content: "WikiOS editing turned on by Admin" }) })
    );
  });

  it("uses DISCORD_ADMIN_USER_ID when set", async () => {
    process.env.DISCORD_BOT_TOKEN = "t0k";
    process.env.DISCORD_ADMIN_USER_ID = "42";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "c" }) });
    await sendAdminDm("x");
    expect(fetchMock.mock.calls[0]![1].body).toBe(JSON.stringify({ recipient_id: "42" }));
  });

  it("swallows Discord failures", async () => {
    process.env.DISCORD_BOT_TOKEN = "t0k";
    fetchMock.mockRejectedValue(new Error("network"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(sendAdminDm("x")).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("stops when the DM channel cannot be opened", async () => {
    process.env.DISCORD_BOT_TOKEN = "t0k";
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await sendAdminDm("x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
