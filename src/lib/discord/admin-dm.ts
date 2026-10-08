/**
 * A Discord DM to the server admin from IxBot: the same bot token (DISCORD_BOT_TOKEN) and recipient as the server's
 * /usr/local/bin/ixwiki-notify.sh. Fire-and-forget: no token is a no-op, and a Discord failure is logged, never thrown.
 */
const API = "https://discord.com/api/v10";
const DEFAULT_ADMIN_USER_ID = "156198941879304192";
const TIMEOUT_MS = 10_000;

async function post(path: string, token: string, body: object): Promise<{ id?: string } | null> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(`[admin-dm] Discord ${path} answered ${response.status}`);
    return null;
  }
  return (await response.json()) as { id?: string };
}

export async function sendAdminDm(content: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  try {
    const recipient_id = process.env.DISCORD_ADMIN_USER_ID || DEFAULT_ADMIN_USER_ID;
    const channel = await post("/users/@me/channels", token, { recipient_id });
    if (!channel?.id) return;
    await post(`/channels/${channel.id}/messages`, token, { content: content.slice(0, 2000) });
  } catch (error) {
    console.warn("[admin-dm] could not send the admin DM:", error instanceof Error ? error.message : error);
  }
}
