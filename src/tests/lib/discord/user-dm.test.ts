/** @jest-environment node */
/**
 * A Discord DM to any user from IxBot (user-dm.ts), and the admin DM that reuses it (admin-dm.ts): no token or a Discord
 * failure answers false, never throws; a DM that reached Discord answers true.
 */
import { sendAdminDm } from "~/lib/discord/admin-dm";
import { sendDiscordDm } from "~/lib/discord/user-dm";

const realFetch = global.fetch;
const previousToken = process.env.DISCORD_BOT_TOKEN;
const previousAdmin = process.env.DISCORD_ADMIN_USER_ID;

type Answer = { status: number; body: object };
let answers: Answer[];
let calls: Array<{ url: string; body: Record<string, string> }>;

beforeEach(() => {
  process.env.DISCORD_BOT_TOKEN = "bot-token";
  delete process.env.DISCORD_ADMIN_USER_ID;
  calls = [];
  answers = [
    { status: 200, body: { id: "dm-channel" } },
    { status: 200, body: { id: "message" } },
  ];
  global.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    const answer = answers.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as never;
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  global.fetch = realFetch;
  if (previousToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
  else process.env.DISCORD_BOT_TOKEN = previousToken;
  if (previousAdmin === undefined) delete process.env.DISCORD_ADMIN_USER_ID;
  else process.env.DISCORD_ADMIN_USER_ID = previousAdmin;
  jest.restoreAllMocks();
});

describe("sendDiscordDm", () => {
  it("opens the user's DM channel and posts the message: true", async () => {
    await expect(sendDiscordDm("42", "hello")).resolves.toBe(true);
    expect(calls).toEqual([
      { url: "https://discord.com/api/v10/users/@me/channels", body: { recipient_id: "42" } },
      {
        url: "https://discord.com/api/v10/channels/dm-channel/messages",
        body: { content: "hello" },
      },
    ]);
  });

  it("cuts the message to Discord's 2000 characters", async () => {
    await sendDiscordDm("42", "x".repeat(2500));
    expect(calls[1]!.body.content).toHaveLength(2000);
  });

  it("without a bot token sends nothing: false", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    await expect(sendDiscordDm("42", "hello")).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it("a refused message is false", async () => {
    answers[1] = { status: 403, body: { message: "Cannot send messages to this user" } };
    await expect(sendDiscordDm("42", "hello")).resolves.toBe(false);
  });

  it("a channel Discord would not open is false, and nothing is posted", async () => {
    answers[0] = { status: 400, body: {} };
    await expect(sendDiscordDm("42", "hello")).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("a network failure is false, never thrown", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNRESET");
    }) as never;
    await expect(sendDiscordDm("42", "hello")).resolves.toBe(false);
  });
});

describe("sendAdminDm", () => {
  it("DMs the server admin through sendDiscordDm", async () => {
    await sendAdminDm("disk full");
    expect(calls[0]!.body).toEqual({ recipient_id: "156198941879304192" });
    expect(calls[1]!.body).toEqual({ content: "disk full" });
  });

  it("DMs DISCORD_ADMIN_USER_ID when it is set", async () => {
    process.env.DISCORD_ADMIN_USER_ID = "7";
    await sendAdminDm("disk full");
    expect(calls[0]!.body).toEqual({ recipient_id: "7" });
  });
});
