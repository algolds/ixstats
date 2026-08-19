import { discordWebhook } from "~/lib/discord/webhook";
import { buildDiscordPollObject, type PollForDiscord } from "~/lib/discord/poll";

const TARGET_CHANNEL_ID = "557016199427522561";

type PollLike = PollForDiscord & { description?: string | null };

/**
 * Build the Discord message payload so it renders as a real, votable poll
 * (not just an embed describing one).
 */
export function buildPollPayload(poll: PollLike) {
  return {
    content: poll.description?.slice(0, 2000) || undefined,
    poll: buildDiscordPollObject(poll),
  };
}

/**
 * Post a poll to Discord as a native poll. Prefers the bot token (posts to the
 * configured channel); falls back to the webhook. Throws if neither is configured
 * or the request fails — callers decide whether to swallow.
 */
export async function postPollToDiscord(poll: PollLike): Promise<void> {
  const payload = buildPollPayload(poll);
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  if (DISCORD_BOT_TOKEN) {
    const res = await fetch(`https://discord.com/api/v10/channels/${TARGET_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`Discord API returned ${res.status} ${res.statusText}`);
    }
    return;
  }

  if (discordWebhook.isEnabled()) {
    await discordWebhook.send(payload);
    return;
  }

  throw new Error("Discord notification not configured or enabled.");
}
