/**
 * A Discord DM to the server admin from IxBot: the same bot token (DISCORD_BOT_TOKEN) and recipient as the server's
 * /usr/local/bin/ixwiki-notify.sh. Fire-and-forget: no token is a no-op, and a Discord failure is logged, never thrown.
 */
import { sendDiscordDm } from "./user-dm";

const DEFAULT_ADMIN_USER_ID = "156198941879304192";

export async function sendAdminDm(content: string): Promise<void> {
  await sendDiscordDm(process.env.DISCORD_ADMIN_USER_ID || DEFAULT_ADMIN_USER_ID, content);
}
