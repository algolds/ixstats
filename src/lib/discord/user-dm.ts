/**
 * A Discord DM to any user from IxBot: the bot token (DISCORD_BOT_TOKEN) opens the user's DM channel and posts the
 * message. Never throws: no token, a channel Discord will not open, a refused message or a network failure all answer
 * false (and are logged); true means Discord took the message.
 */
const API = "https://discord.com/api/v10";
const TIMEOUT_MS = 10_000;
/** Discord's longest message, in characters. */
const MESSAGE_MAX = 2000;

async function post(path: string, token: string, body: object): Promise<{ id?: string } | null> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(`[discord-dm] Discord ${path} answered ${response.status}`);
    return null;
  }
  return (await response.json()) as { id?: string };
}

export async function sendDiscordDm(recipientId: string, content: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !recipientId) return false;
  try {
    const channel = await post("/users/@me/channels", token, { recipient_id: recipientId });
    if (!channel?.id) return false;
    const message = await post(`/channels/${channel.id}/messages`, token, {
      content: content.slice(0, MESSAGE_MAX),
    });
    return message !== null;
  } catch (error) {
    console.warn(
      "[discord-dm] could not send the DM:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
