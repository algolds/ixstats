import { discordWebhook } from "~/lib/discord-webhook";

const TARGET_CHANNEL_ID = "557016199427522561";

// Discord native-poll limits: https://discord.com/developers/docs/resources/poll
const MAX_QUESTION = 300;
const MAX_ANSWER = 55;
const MAX_ANSWERS = 10;
const MAX_DURATION_HOURS = 768; // 32 days

interface PollLike {
  question: string;
  description?: string | null;
  multiple: boolean;
  endDate?: Date | null;
  options: { label: string }[];
}

/**
 * Build Discord's native poll payload so the message renders as a real,
 * votable Discord poll (not just an embed describing one).
 */
export function buildPollPayload(poll: PollLike) {
  // duration is whole hours from now to endDate, clamped to Discord's bounds.
  let duration = 24;
  if (poll.endDate) {
    const hours = Math.ceil((poll.endDate.getTime() - Date.now()) / 3_600_000);
    duration = Math.min(Math.max(hours, 1), MAX_DURATION_HOURS);
  }
  return {
    content: poll.description?.slice(0, 2000) || undefined,
    poll: {
      question: { text: poll.question.slice(0, MAX_QUESTION) },
      answers: poll.options.slice(0, MAX_ANSWERS).map((o) => ({
        poll_media: { text: o.label.slice(0, MAX_ANSWER) },
      })),
      duration,
      allow_multiselect: poll.multiple,
    },
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
    const res = await fetch(
      `https://discord.com/api/v10/channels/${TARGET_CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      }
    );
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
