import { PrismaClient } from "@prisma/client";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const IXTWITTER_CHANNEL_ID = process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818";

function extractPrimaryHandle(content: string): string | null {
  const match = content.match(/[@•]\s*@?([A-Za-z0-9_]+)/);
  return match?.[1] || null;
}

function formatPostContent(content: string): string {
  let c = content.trim();
  c = c.replace(/^\*\*(?=.*?(?:@|:verified:)).*?\*\*\s*?\n/, "");
  return c;
}

async function main() {
  if (!DISCORD_BOT_TOKEN) {
    console.log("No Discord bot token configured!");
    return;
  }

  const res = await fetch(
    `https://discord.com/api/v10/channels/${IXTWITTER_CHANNEL_ID}/messages?limit=25`,
    {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    }
  );
  if (!res.ok) {
    console.log(`Failed to fetch: ${res.status}`);
    return;
  }

  const messages: any[] = await res.json();
  console.log(`Fetched ${messages.length} messages.`);

  for (const msg of messages) {
    if (msg.author.bot) continue;
    console.log("\n-------------------------------------------");
    console.log(`Message ID: ${msg.id}`);
    console.log(`Author: ${msg.author.username}`);
    console.log(`Raw Content:\n${msg.content}`);
    console.log(`--> Extracted Handle: ${extractPrimaryHandle(msg.content)}`);
    console.log(`--> Parsed Content:\n${formatPostContent(msg.content)}`);
  }
}

main().catch(console.error);
