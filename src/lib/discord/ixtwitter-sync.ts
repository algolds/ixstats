/**
 * Discord IxTwitter Auto-Poster
 *
 * Polls the IxTwitter Discord channel for new messages and creates
 * ThinkPages posts with proper attribution. Each Discord user gets their
 * own ThinkPages account linked to their country (if confirmed) or
 * marked as "Former Nation" (if not in the current country list).
 *
 * Runs as a cron job in production.
 */

import type { PrismaClient } from "@prisma/client";
import { db as sharedDb } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import * as path from "path";
import { DOMParser } from "@xmldom/xmldom";
import { buildDiscordPollObject } from "./poll";
import { ordinal, parseSportsBulletin, type SportsBulletinData } from "~/lib/sports/feed-bulletins";
import { cleanPostContent } from "./thinkpages-feed";

const IXTWITTER_CHANNEL_ID = process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818";
// IxTwitter is one-way (Discord → feed only). The dedicated ThinkPages channel handles feed → Discord.
// ponytail: flag, not env — flip to re-enable feed → IxTwitter mirroring if ever wanted.
const FEED_TO_IXTWITTER_ENABLED = false;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API_BASE = "https://discord.com/api/v10";
const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";
const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://maps.ixwiki.com"
).replace(/\/$/, "");
const CLEAN_BASE_PATH = BASE_PATH
  ? (BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`).replace(/\/$/, "")
  : "";

const DEFAULT_COUNTRY_ID = process.env.DISCORD_POST_COUNTRY_ID || "";

const DISCORD_IMAGE_DIR = path.join(process.cwd(), "public", "images", "discord");

async function downloadDiscordImage(
  url: string,
  messageId: string,
  index: number
): Promise<string> {
  try {
    if (!existsSync(DISCORD_IMAGE_DIR)) {
      mkdirSync(DISCORD_IMAGE_DIR, { recursive: true });
    }

    const extMatch = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
    const ext = extMatch ? extMatch[1]!.toLowerCase() : "jpg";
    const filename = `discord_${messageId}_${index}.${ext}`;
    const filePath = path.join(DISCORD_IMAGE_DIR, filename);

    if (existsSync(filePath)) return `${CLEAN_BASE_PATH}/images/discord/${filename}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return url;

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(filePath, buffer);

    return `${CLEAN_BASE_PATH}/images/discord/${filename}`;
  } catch {
    return url;
  }
}

// Discord username → country name mapping (confirmed countries only)
const DISCORD_COUNTRY_MAP: Record<string, string> = {
  urcea: "Urcea",
  well8389: "The Cape",
  cyril_gwynne_spyncer: "Castadilla",
  mr_ballz1111111: "Tierrador",
  youngheroes: "Argyrea",
  radamancio: "Pelaxia",
  keaor: "Faneria",
  masinstante: "Kiravia",
  bourgondie: "Burgundie",
  bobbo3: "Daxia",
  potatolover9566: "Canespa",
  laughing_tree: "Fiannria",
  jaded_outcast: "Kabasa",
  meridian58: "Kabasa",
  helvianir: "Maresteyn",
  samuel_pw: "Olmeria",
  extrudi: "Caphiria",
  grisblanco: "Cartadania",
  thatvillagerguy: "Kostava",
  iander: "Yonderre",
  ".stealie_2": "Thervala",
  fabong1722: "Metzetta",
  glubert2004: "Nasastan",
  bolasbirdepicalcoholicnetwork: "Nasastan",
  cdr_mustang: "Alstin",
  heku_: "Caphiria",
};

// Country name → country ID (populated at runtime)
// eslint-disable-next-line prefer-const
let COUNTRY_ID_CACHE: Record<string, string> = {};

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    bot: boolean;
  };
  attachments: Array<{
    id: string;
    url: string;
    proxy_url: string;
    content_type?: string;
    width?: number;
    height?: number;
  }>;
  embeds?: Array<{
    url?: string;
    type?: string;
    title?: string;
    description?: string;
    image?: {
      url: string;
    };
    thumbnail?: {
      url: string;
    };
  }>;
  timestamp: string;
  referenced_message?: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
      bot: boolean;
    };
  } | null;
  message_reference?: {
    message_id?: string;
  } | null;
  reactions?: Array<{
    emoji: {
      id: string | null;
      name: string;
    };
    count: number;
    me: boolean;
  }> | null;
}

async function fetchDiscordMessages(after?: string, before?: string): Promise<DiscordMessage[]> {
  if (!DISCORD_BOT_TOKEN) {
    console.warn("[DiscordPoster] DISCORD_BOT_TOKEN not set, skipping");
    return [];
  }

  const params = new URLSearchParams({ limit: "100" });
  if (after) params.set("after", after);
  if (before) params.set("before", before);

  const res = await fetch(
    `${DISCORD_API_BASE}/channels/${IXTWITTER_CHANNEL_ID}/messages?${params}`,
    {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(15000), // 15s timeout for Discord API
    }
  );

  if (!res.ok) {
    console.error(`[DiscordPoster] Failed to fetch messages: ${res.status} ${res.statusText}`);
    return [];
  }

  return res.json() as Promise<DiscordMessage[]>;
}

function getDiscordAvatarUrl(author: DiscordMessage["author"]): string | null {
  if (!author.avatar) return null;
  const ext = author.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${ext}?size=128`;
}

function formatPostContent(message: DiscordMessage): string {
  let content = message.content.trim();
  // Match a bold block at the start of the message: **header**
  const headerMatch = content.match(/^\*\*([^*]+?)\*\*/);
  if (headerMatch) {
    const headerText = headerMatch[1] || "";
    // If it looks like a profile header (contains @ or :verified:)
    if (headerText.includes("@") || headerText.includes(":verified:")) {
      // Strip the header and any trailing whitespace/newlines
      content = content.slice(headerMatch[0].length).trim();
    }
  }
  return content;
}

async function loadCountryIdCache(db: PrismaClient) {
  const countryNames = Array.from(new Set(Object.values(DISCORD_COUNTRY_MAP)));
  // The Discord map names IxWorld nations; names repeat across realms (ruling E-p).
  const countries = await db.country.findMany({
    where: { realmId: DEFAULT_REALM_ID, name: { in: countryNames } },
    select: { name: true, id: true },
  });
  for (const c of countries) {
    COUNTRY_ID_CACHE[c.name] = c.id;
  }
}

async function getOrCreateDiscordAccount(
  db: PrismaClient,
  discordUsername: string,
  message: DiscordMessage,
  displayName: string
): Promise<{ accountId: string; isFormerNation: boolean }> {
  const mappedCountry = DISCORD_COUNTRY_MAP[discordUsername];
  const isFormerNation = !mappedCountry;

  // Try to find existing account by discord username
  const existingAccount = await db.thinkpagesAccount.findFirst({
    where: {
      OR: [{ username: discordUsername }, { bio: { contains: `discord:${discordUsername}` } }],
    },
  });

  if (existingAccount) {
    return { accountId: existingAccount.id, isFormerNation };
  }

  const countryId = mappedCountry ? COUNTRY_ID_CACHE[mappedCountry] : null;
  const defaultCountryId = DEFAULT_COUNTRY_ID || (await getDefaultCountryId(db));

  const avatarUrl = getDiscordAvatarUrl(message.author);

  const account = await db.thinkpagesAccount.create({
    data: {
      username: discordUsername,
      displayName: displayName,
      firstName: displayName.split(" ")[0] || message.author.username,
      lastName: displayName.split(" ").slice(1).join(" ") || "",
      accountType: "citizen",
      clerkUserId: `system_ixtwitter_${discordUsername}`,
      countryId: countryId || defaultCountryId,
      verified: !isFormerNation,
      isActive: true,
      bio: isFormerNation
        ? `Former Nation — discord:${discordUsername}`
        : `discord:${discordUsername}`,
      profileImageUrl: avatarUrl || undefined,
    },
  });

  console.log(
    `[DiscordPoster] Created account: ${account.username} (${isFormerNation ? "Former Nation" : mappedCountry})`
  );

  return { accountId: account.id, isFormerNation };
}

function extractPrimaryHandle(content: string): string | null {
  // 1. Try to find an explicit @handle first
  const atMatch = content.match(/@([^\s•*<>:|]+)/);
  if (atMatch) return atMatch[1] || null;

  // 2. Fall back to • handle pattern if no @ is present
  const bulletMatch = content.match(/•\s*([^\s•*<>:|]+)/);
  if (bulletMatch) return bulletMatch[1] || null;

  return null;
}

function extractDisplayName(content: string, defaultName: string): string {
  // First try the standard bullet format: **• Display Name • @handle
  const bulletMatch = content.match(/\*\*•\s*([^\n•@<*]+?)\s*(?:•|@|<|\*\*)/);
  if (bulletMatch && bulletMatch[1]) {
    return bulletMatch[1].trim();
  }
  // Fallback to simple bold format: **Display Name**
  const boldMatch = content.match(/\*\*([^\n@<*]+?)\*\*/);
  if (boldMatch && boldMatch[1]) {
    return boldMatch[1].trim();
  }
  return defaultName;
}

async function getOrCreateHandleAccount(
  db: PrismaClient,
  handle: string,
  discordUsername: string,
  displayName: string
): Promise<string | null> {
  // Try to find existing handle account
  const existingAccount = await db.thinkpagesAccount.findUnique({
    where: { username: handle },
  });
  if (existingAccount) {
    return existingAccount.id;
  }

  // Get the main Discord user account to inherit country/verified status
  const mainAccount = await db.thinkpagesAccount.findFirst({
    where: {
      OR: [{ username: discordUsername }, { bio: { contains: `discord:${discordUsername}` } }],
    },
    select: { id: true, verified: true, countryId: true },
  });

  if (!mainAccount) {
    return null;
  }

  try {
    const account = await db.thinkpagesAccount.create({
      data: {
        username: handle,
        displayName: displayName,
        firstName: displayName.split(" ")[0] || handle,
        lastName: displayName.split(" ").slice(1).join(" ") || "",
        accountType: "media",
        clerkUserId: `system_ixtwitter_handle_${handle}`,
        countryId: mainAccount.countryId,
        verified: mainAccount.verified,
        isActive: true,
        bio: `discord:${discordUsername}`,
      },
    });
    console.log(`[DiscordPoster] Created handle account: @${handle} (${displayName})`);
    return account.id;
  } catch {
    return null;
  }
}

// oxlint-disable-next-line typescript/no-unused-vars

async function getPostedMessageIds(db: PrismaClient): Promise<Map<string, string>> {
  const postedIds = new Map<string, string>();
  let cursor = 0;
  const batchSize = 500;

  while (true) {
    const posts = await db.thinkpagesPost.findMany({
      where: { isAutoGenerated: true },
      select: { content: true, accountId: true },
      skip: cursor,
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });

    if (posts.length === 0) break;

    for (const post of posts) {
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match) postedIds.set(match[1]!, post.accountId);
    }

    if (posts.length < batchSize) break;
    cursor += batchSize;
  }

  return postedIds;
}

/** Unicode / short-name reactions per IxStats react type. */
const REACTION_ALIASES: Record<string, string[]> = {
  like: ["❤️", "❤", "like", "heart"],
  laugh: ["😂", "😆", "😄", "😀", "laugh", "smile"],
  angry: ["😡", "😠", "angry"],
  fire: ["🔥", "fire"],
  thumbsup: ["👍", "thumbsup"],
  thumbsdown: ["👎", "thumbsdown"],
};
const REACTION_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(REACTION_ALIASES).flatMap(([type, names]) => names.map((name) => [name, type]))
);

function mapDiscordReactions(reactions?: DiscordMessage["reactions"]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { emoji, count } of reactions ?? []) {
    // Custom Discord emoji are keyed discord:name:id; anything unmapped keeps its unicode character
    const type = emoji.id
      ? `discord:${emoji.name}:${emoji.id}`
      : (REACTION_TYPES[emoji.name] ?? emoji.name);
    counts[type] = (counts[type] || 0) + count;
  }
  return counts;
}

const IMAGE_URL_PATTERN = /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i;

/** Up to four distinct images from a message's attachments and embeds (GIF embeds included). */
function collectMedia(message: DiscordMessage): { url: string; mimeType: string }[] {
  const media: { url: string; mimeType: string }[] = [];

  for (const a of message.attachments ?? []) {
    if (a.content_type?.startsWith("image/") || IMAGE_URL_PATTERN.test(a.url)) {
      media.push({ url: a.url, mimeType: a.content_type ?? "image/jpeg" });
    }
  }

  // Embeds such as Tenor/Giphy GIFs or linked images
  for (const embed of message.embeds ?? []) {
    const url = embed.image?.url || embed.thumbnail?.url;
    const isMediaEmbed = embed.type === "image" || embed.type === "gifv";
    if (url && (isMediaEmbed || IMAGE_URL_PATTERN.test(url))) {
      const isGif = embed.type === "gifv" || url.includes(".gif");
      media.push({ url, mimeType: isGif ? "image/gif" : "image/jpeg" });
    }
  }

  const seen = new Set<string>();
  return media.filter((m) => !seen.has(m.url) && seen.add(m.url)).slice(0, 4);
}

async function createPostFromMessage(
  db: PrismaClient,
  accountId: string,
  message: DiscordMessage
): Promise<boolean> {
  const content = formatPostContent(message);
  if (!content) return false;

  const contentWithMarker = `${content}\n\n[DiscordMsg:${message.id}]`;
  const timestamp = new Date(message.timestamp);

  // Extract parent post by matching the Discord referenced message ID
  let parentPostId: string | null = null;
  const parentMessageId = message.referenced_message?.id || message.message_reference?.message_id;
  if (parentMessageId) {
    const parentPost = await db.thinkpagesPost.findFirst({
      where: {
        content: { contains: `[DiscordMsg:${parentMessageId}]` },
      },
      select: { id: true },
    });
    if (parentPost) {
      parentPostId = parentPost.id;
    }
  }

  // Check if a post with this Discord message ID already exists,
  // or if there is an existing post from this account with the exact same timestamp.
  const existingPost = await db.thinkpagesPost.findFirst({
    where: {
      isAutoGenerated: true,
      OR: [
        { content: { contains: `[DiscordMsg:${message.id}]` } },
        {
          accountId,
          ixTimeTimestamp: timestamp,
        },
      ],
    },
  });

  const hashtags = content.match(/#[\w]+/g)?.map((t) => t.slice(1)) || [];

  // Parse Discord reactions into the IxStats react system format
  const reactionMap = mapDiscordReactions(message.reactions);
  const reactionCounts = Object.keys(reactionMap).length > 0 ? JSON.stringify(reactionMap) : null;
  const likeCount = reactionMap["like"] || 0;

  if (existingPost) {
    // If it already exists, let's update it to ensure it has the full, untruncated content and the [DiscordMsg:id] marker!
    if (
      existingPost.content !== contentWithMarker ||
      (parentPostId && existingPost.parentPostId !== parentPostId) ||
      existingPost.reactionCounts !== reactionCounts
    ) {
      await db.thinkpagesPost.update({
        where: { id: existingPost.id },
        data: {
          content: contentWithMarker,
          hashtags: hashtags.length > 0 ? JSON.stringify(hashtags) : null,
          postType: parentPostId ? "reply" : existingPost.postType,
          parentPostId: parentPostId || existingPost.parentPostId,
          likeCount,
          reactionCounts,
        },
      });
      console.log(
        `[DiscordPoster] Updated truncated/legacy post ${existingPost.id} to full content with marker, reply link, and reactions`
      );
    }
    return true;
  }

  const uniqueMedia = collectMedia(message);

  const mediaEntries = await Promise.all(
    uniqueMedia.map(async (m, index) => {
      const localUrl = await downloadDiscordImage(m.url, message.id, index);
      return {
        type: "image" as const,
        url: localUrl,
        filename: `discord_${message.id}_${index}`,
        mimeType: m.mimeType,
      };
    })
  );

  await db.thinkpagesPost.create({
    data: {
      accountId,
      content: contentWithMarker,
      hashtags: hashtags.length > 0 ? JSON.stringify(hashtags) : null,
      postType: parentPostId ? "reply" : "original",
      parentPostId,
      visibility: "public",
      isAutoGenerated: true,
      ixTimeTimestamp: timestamp,
      likeCount,
      reactionCounts,
      mediaAttachments:
        mediaEntries.length > 0 ? { createMany: { data: mediaEntries } } : undefined,
    },
  });

  return true;
}

export async function syncIxTwitterToThinkPages(): Promise<{ posted: number; skipped: number }> {
  if (!DISCORD_BOT_TOKEN) {
    console.warn("[DiscordPoster] DISCORD_BOT_TOKEN not set, skipping sync");
    return { posted: 0, skipped: 0 };
  }

  // Cross-process single-flight (plan 328): the poller ticks every 5 min with no
  // guard of its own, so a slow sync must skip rather than overlap the next tick.
  const outcome = await withJobLock(sharedDb, "ixtwitter-sync", () => runIxTwitterSync(sharedDb), {
    timeoutMs: 10 * 60_000,
  });
  return outcome.ran ? outcome.result : { posted: 0, skipped: 0 };
}

async function runIxTwitterSync(db: PrismaClient): Promise<{ posted: number; skipped: number }> {
  try {
    await loadCountryIdCache(db);

    const messages = await fetchDiscordMessages();
    if (messages.length === 0) {
      console.log("[DiscordPoster] No new messages to sync");
      return { posted: 0, skipped: 0 };
    }

    const postedIds = await getPostedMessageIds(db);

    const validMessages = messages.filter(
      (m) => !m.author.bot && m.content.trim().length > 0 && !postedIds.has(m.id)
    );

    let posted = 0;
    let skipped = 0;

    for (const message of validMessages.reverse()) {
      try {
        const handle = extractPrimaryHandle(message.content);
        const displayName = extractDisplayName(message.content, message.author.username);

        // Ensure the main Discord user account exists
        await getOrCreateDiscordAccount(db, message.author.username, message, displayName);

        let accountId: string;
        if (handle) {
          const handleAccountId = await getOrCreateHandleAccount(
            db,
            handle,
            message.author.username,
            displayName
          );
          accountId =
            handleAccountId ||
            (await getOrCreateDiscordAccount(db, message.author.username, message, displayName))
              .accountId;
        } else {
          accountId = (
            await getOrCreateDiscordAccount(db, message.author.username, message, displayName)
          ).accountId;
        }

        const ok = await createPostFromMessage(db, accountId, message);
        if (ok) {
          posted++;
          console.log(
            `[DiscordPoster] Posted: ${message.author.username} @${handle || "(no handle)"} - ${formatPostContent(message).slice(0, 50)}...`
          );
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`[DiscordPoster] Failed to post message ${message.id}:`, error);
        skipped++;
      }
    }

    console.log(`[DiscordPoster] Sync complete: ${posted} posted, ${skipped} skipped`);
    return { posted, skipped };
  } catch (error) {
    console.error("[DiscordPoster] Sync failed:", error);
    return { posted: 0, skipped: 0 };
  }
}

async function getDefaultCountryId(db: PrismaClient): Promise<string> {
  const country = await db.country.findFirst({ select: { id: true } });
  if (country) return country.id;
  throw new Error("No country found in database for bot account");
}

function mapThinkpagesReactionToDiscord(reactionType: string): string {
  if (reactionType.startsWith("discord:")) {
    const parts = reactionType.split(":");
    const name = parts[1] || "";
    const id = parts[2] || "";
    if (id) return `${name}:${id}`;
    return name;
  }

  switch (reactionType) {
    case "like":
      return "❤️";
    case "laugh":
      return "😂";
    case "angry":
      return "😡";
    case "sad":
      return "😢";
    case "fire":
      return "🔥";
    case "thumbsup":
      return "👍";
    case "thumbsdown":
      return "👎";
    default:
      return reactionType;
  }
}

function formatCodeBlockTable(results: any[]): string {
  if (!results || results.length === 0) return "";
  const maxHomeLen = Math.max(...results.map((r) => String(r.home?.name || "").length), 10);
  const lines = results.map((r) => {
    const home = String(r.home?.name || "").padEnd(maxHomeLen, " ");
    const score = `${r.homeScore} - ${r.awayScore}`;
    const away = String(r.away?.name || "");
    const upsetMarker = r.isUpset ? "  [Upset ⭐]" : "";
    return `${home}  ${score}  ${away}${upsetMarker}`;
  });
  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

/** Feed posts mirrored to Discord: the feed is IxStats; ThinkPages names the forum (U2). */
const FEED_FOOTER = {
  text: "Shared from IxStats",
  icon_url: `${APP_URL}${CLEAN_BASE_PATH}/thinkpages-logo.svg`,
};

const SPORT_EMBED_COLORS: Record<string, number> = {
  "⚽": 0x22c55e,
  "🏀": 0xf97316,
  "🏒": 0x38bdf8,
  "🏈": 0x8b5cf6,
};

/** The embed plus one image-only embed per extra media URL (Discord shows several images that way). */
function withMedia(embed: Record<string, any>, mediaUrls?: string[]): any[] {
  const urls = (mediaUrls ?? []).map((u) => (u.startsWith("http") ? u : `${APP_URL}${u}`));
  if (urls.length === 0) return [embed];
  embed.image = { url: urls[0] };
  return [embed, ...urls.slice(1).map((image) => ({ url: embed.url, image: { url: image } }))];
}

function sportsEmbedTitle(sports: SportsBulletinData): string {
  const { sportEmoji, league } = sports;
  if (sports.isChampionBulletin) return `🏆 ${league.name} CHAMPION CROWNED!`;
  if (sports.isPlayoffBulletin)
    return `${sportEmoji} ${league.name} Playoff ${sports.roundName} Results`;
  if (sports.matchDay) return `${sportEmoji} ${league.name} — Matchday ${sports.matchDay}`;
  return `${sportEmoji} ${league.name}`;
}

function sportsEmbedBody(sports: SportsBulletinData): { description: string; fields: any[] } {
  const summary = (name: string) =>
    sports.llmSummary ? [{ name, value: `*${sports.llmSummary}*`, inline: false }] : [];

  if (sports.isChampionBulletin) {
    return {
      description: `Congratulations to **${sports.championName}** for winning the championship!`,
      fields: summary("📝 Season Summary"),
    };
  }

  const movers = sports.movers?.length
    ? [
        {
          name: "📈 Table Movers",
          value: sports.movers
            .map((m) => {
              const diff = m.oldRank - m.newRank;
              return `${m.newRank < m.oldRank ? "▲" : "▼"} **${m.name}** (${diff > 0 ? "+" : ""}${diff} spots, ${ordinal(m.oldRank)} → ${ordinal(m.newRank)})`;
            })
            .join("\n"),
          inline: false,
        },
      ]
    : [];
  return {
    description: sports.results?.length ? formatCodeBlockTable(sports.results) : "",
    fields: [...movers, ...summary("📝 Summary")],
  };
}

export function formatThinkPagesEmbed(
  post: { id: string; content: string; ixTimeTimestamp?: Date | string },
  account: {
    displayName: string;
    username: string;
    verified: boolean;
    profileImageUrl?: string | null;
  },
  mediaUrls?: string[]
): any[] {
  const url = `${APP_URL}${CLEAN_BASE_PATH}/dashboard/post/${post.id}`;
  const author = {
    name: `${account.displayName} (@${account.username})${account.verified ? " \u2705" : ""}`,
    icon_url: account.profileImageUrl
      ? account.profileImageUrl.startsWith("http")
        ? account.profileImageUrl
        : `${APP_URL}${account.profileImageUrl}`
      : "https://via.placeholder.com/150/4F46E5/FFFFFF?text=User",
    url,
  };
  const timestamp = (
    post.ixTimeTimestamp ? new Date(post.ixTimeTimestamp) : new Date()
  ).toISOString();

  const sports = parseSportsBulletin(post.content);
  if (sports?.league?.name) {
    const leagueUrl = sports.league.id
      ? `${APP_URL}${CLEAN_BASE_PATH}/myleague/${sports.league.id}`
      : url;
    const { description, fields } = sportsEmbedBody(sports);
    const link = `🔗 [View Matchday & Standings on IxStates](${leagueUrl})`;
    return withMedia(
      {
        url: leagueUrl,
        author,
        title: sportsEmbedTitle(sports),
        description: description ? `${description}\n${link}` : link,
        fields,
        color: sports.isPlayoffBulletin
          ? 0x06b6d4 // cyan
          : (SPORT_EMBED_COLORS[sports.sportEmoji] ?? 0xf59e0b), // default gold
        footer: FEED_FOOTER,
        timestamp,
      },
      mediaUrls
    );
  }

  let description = htmlToDiscordMarkdown(cleanPostContent(post.content));
  if (description.length > 4000) description = description.slice(0, 3997) + "...";
  return withMedia(
    { url, author, description, color: 0x9835ff, footer: FEED_FOOTER, timestamp },
    mediaUrls
  );
}

export async function postThinkPagesToDiscord(
  db: PrismaClient,
  post: { id: string; content: string; ixTimeTimestamp?: Date | string; pollId?: string | null },
  account: {
    displayName: string;
    username: string;
    verified: boolean;
    profileImageUrl?: string | null;
  },
  mediaUrls?: string[]
): Promise<boolean> {
  if (!FEED_TO_IXTWITTER_ENABLED) return false;
  if (!DISCORD_BOT_TOKEN) {
    console.warn("[DiscordPoster] DISCORD_BOT_TOKEN not set, skipping autopost to Discord");
    return false;
  }

  try {
    const embeds = formatThinkPagesEmbed(post, account, mediaUrls);

    // If the post has an attached poll, render it as a native, votable Discord poll
    // in the same message (Discord allows embeds + poll together).
    let poll: ReturnType<typeof buildDiscordPollObject> | undefined;
    if (post.pollId) {
      const pollRow = await db.poll.findUnique({
        where: { id: post.pollId },
        select: {
          question: true,
          multiple: true,
          endDate: true,
          options: { select: { label: true } },
        },
      });
      if (pollRow && pollRow.options.length >= 2) {
        poll = buildDiscordPollObject(pollRow);
      }
    }

    const res = await fetch(`${DISCORD_API_BASE}/channels/${IXTWITTER_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)",
      },
      body: JSON.stringify(poll ? { embeds, poll } : { embeds }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(
        `[DiscordPoster] Failed to post message to Discord: ${res.status} ${res.statusText}`
      );
      return false;
    }

    const discordMsg = (await res.json()) as { id: string };
    console.log(
      `[DiscordPoster] Autoposted thinkpages post ${post.id} to Discord as msg ${discordMsg.id}`
    );

    // Update the post content in the database to append the marker
    await db.thinkpagesPost.update({
      where: { id: post.id },
      data: {
        content: `${post.content}\n\n[DiscordMsg:${discordMsg.id}]`,
      },
    });

    return true;
  } catch (error) {
    console.error("[DiscordPoster] Error autoposting to Discord:", error);
    return false;
  }
}

export async function editDiscordMessage(
  messageId: string,
  post: { id: string; content: string; ixTimeTimestamp?: Date | string },
  account: {
    displayName: string;
    username: string;
    verified: boolean;
    profileImageUrl?: string | null;
  },
  mediaUrls?: string[]
): Promise<boolean> {
  if (!FEED_TO_IXTWITTER_ENABLED) return false;
  if (!DISCORD_BOT_TOKEN) return false;
  try {
    const embeds = formatThinkPagesEmbed(post, account, mediaUrls);
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${IXTWITTER_CHANNEL_ID}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "IxStats/1.0",
        },
        body: JSON.stringify({ embeds }),
        signal: AbortSignal.timeout(15000),
      }
    );
    return res.ok;
  } catch (error) {
    console.error(`[DiscordPoster] Error editing message ${messageId}:`, error);
    return false;
  }
}

export async function deleteDiscordMessage(messageId: string): Promise<boolean> {
  if (!FEED_TO_IXTWITTER_ENABLED) return false;
  if (!DISCORD_BOT_TOKEN) return false;
  try {
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${IXTWITTER_CHANNEL_ID}/messages/${messageId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "User-Agent": "IxStats/1.0",
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    return res.ok;
  } catch (error) {
    console.error(`[DiscordPoster] Error deleting message ${messageId}:`, error);
    return false;
  }
}

export async function addDiscordReaction(
  messageId: string,
  reactionType: string
): Promise<boolean> {
  if (!FEED_TO_IXTWITTER_ENABLED) return false;
  if (!DISCORD_BOT_TOKEN) return false;
  try {
    const emoji = mapThinkpagesReactionToDiscord(reactionType);
    const encodedEmoji = encodeURIComponent(emoji);
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${IXTWITTER_CHANNEL_ID}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "User-Agent": "IxStats/1.0",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    return res.ok;
  } catch (error) {
    console.error(
      `[DiscordPoster] Error adding reaction ${reactionType} to message ${messageId}:`,
      error
    );
    return false;
  }
}

export async function removeDiscordReaction(
  messageId: string,
  reactionType: string
): Promise<boolean> {
  if (!FEED_TO_IXTWITTER_ENABLED) return false;
  if (!DISCORD_BOT_TOKEN) return false;
  try {
    const emoji = mapThinkpagesReactionToDiscord(reactionType);
    const encodedEmoji = encodeURIComponent(emoji);
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${IXTWITTER_CHANNEL_ID}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "User-Agent": "IxStats/1.0",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    return res.ok;
  } catch (error) {
    console.error(
      `[DiscordPoster] Error removing reaction ${reactionType} from message ${messageId}:`,
      error
    );
    return false;
  }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function autoCloseHtmlTags(html: string): string {
  const tags = [
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "strike",
    "code",
    "pre",
    "p",
    "a",
    "ul",
    "ol",
    "li",
  ];
  let closedHtml = html;

  for (const tag of tags) {
    const openCount = (closedHtml.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || []).length;
    const closeCount = (closedHtml.match(new RegExp(`</${tag}>`, "gi")) || []).length;

    if (openCount > closeCount) {
      const missing = openCount - closeCount;
      closedHtml += `</${tag}>`.repeat(missing);
    }
  }

  return closedHtml;
}

export function htmlToDiscordMarkdown(html: string): string {
  if (!html) return "";

  const closedHtml = autoCloseHtmlTags(html);

  try {
    const parser = new DOMParser({
      onError: (level, message) => {
        if (level === "fatalError") {
          throw new Error(message);
        }
      },
    });

    const doc = parser.parseFromString(`<div>${closedHtml}</div>`, "text/xml");
    const root = doc.documentElement;
    if (root) {
      const result = convertNodeToMarkdown(root).trim();
      return result.replace(/\n{3,}/g, "\n\n");
    }
  } catch (err) {
    console.warn("[htmlToDiscordMarkdown] XML parsing failed, using regex fallback:", err);
  }

  return fallbackHtmlToMarkdown(closedHtml);
}

/** Site-relative links become absolute so they work outside IxStates. */
const absoluteUrl = (href: string) =>
  href.startsWith("/") && !href.startsWith("//") ? `${APP_URL}${CLEAN_BASE_PATH}${href}` : href;

const wikiEmbedMarkdown = (title: string, summary: string, source: string) => {
  const wikiUrl = `${APP_URL}${CLEAN_BASE_PATH}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  return `\n**Wiki Embed: [${title}](${wikiUrl})**\n*Source: ${source}*\n> ${summary}\n`;
};

/** Markdown wrapping per element; tags not listed pass their children through. */
const TAG_MARKDOWN: Record<string, (children: string) => string> = {
  p: (c) => `\n${c}\n`,
  strong: (c) => `**${c}**`,
  b: (c) => `**${c}**`,
  em: (c) => `*${c}*`,
  i: (c) => `*${c}*`,
  u: (c) => `__${c}__`,
  s: (c) => `~~${c}~~`,
  del: (c) => `~~${c}~~`,
  strike: (c) => `~~${c}~~`,
  code: (c) => `\`${c}\``,
  pre: (c) => `\`\`\`\n${c}\n\`\`\``,
  ul: (c) => `\n${c}\n`,
  ol: (c) => `\n${c}\n`,
  li: (c) => `- ${c.trim()}\n`,
  br: () => "\n",
};

function convertNodeToMarkdown(node: any): string {
  if (!node) return "";
  if (node.nodeType === 3) return decodeHtmlEntities(node.nodeValue || "");
  if (node.nodeType !== 1) return "";

  const tagName = node.tagName.toLowerCase();
  const children = Array.from(node.childNodes || [])
    .map((child) => convertNodeToMarkdown(child))
    .join("");
  const attr = (name: string): string => node.getAttribute?.(name) || "";

  switch (tagName) {
    case "div":
      return attr("data-wikiembed") === "true"
        ? wikiEmbedMarkdown(
            attr("data-title"),
            attr("data-summary"),
            attr("data-source") || "ixwiki"
          )
        : children;
    case "a":
      return `[${children}](${absoluteUrl(attr("href"))})`;
    case "img":
      return `[Image: ${attr("alt") || "image"}](${attr("src")})`;
    default:
      return TAG_MARKDOWN[tagName]?.(children) ?? children;
  }
}

function fallbackHtmlToMarkdown(html: string): string {
  // Tag pairs whose content is wrapped as-is
  const wrap =
    (tags: string[], open: string, close = open) =>
    (text: string) =>
      tags.reduce(
        (acc, tag) =>
          acc.replace(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gi"), `${open}$1${close}`),
        text
      );

  let text = html.replace(
    /<div[^>]*data-wikiembed="true"[^>]*data-title="([^"]+)"[^>]*data-summary="([^"]*)"[^>]*data-source="([^"]*)"[^>]*><\/div>/gi,
    (_, title, summary, source) =>
      wikiEmbedMarkdown(
        decodeHtmlEntities(title),
        decodeHtmlEntities(summary),
        decodeHtmlEntities(source || "ixwiki")
      )
  );

  // Structural elements
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:p|ul|ol)[^>]*>|<\/(?:p|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n");

  // Inline formatting
  text = wrap(["strong", "b"], "**")(text);
  text = wrap(["em", "i"], "*")(text);
  text = wrap(["u"], "__")(text);
  text = wrap(["s", "del", "strike"], "~~")(text);
  text = wrap(["code"], "`")(text);
  text = wrap(["pre"], "```\n", "\n```")(text);

  text = text
    .replace(
      /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi,
      (_, href, content) => `[${content}](${absoluteUrl(href)})`
    )
    .replace(
      /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
      (_, src, alt) => `[Image: ${alt || "image"}](${src})`
    )
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(text)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
