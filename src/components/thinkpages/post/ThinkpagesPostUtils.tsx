import React from "react";
import {
  Smile,
  Angry,
  ThumbsUp,
  ThumbsDown,
  Flame,
  Heart,
  Crown,
  Newspaper,
  Users,
} from "lucide-react";
import { withBasePath } from "../../../lib/base-path";
import { useRelativeTime } from "../../../hooks/useRelativeTime";

export const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  government: Crown,
  media: Newspaper,
  citizen: Users,
};

export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  government: "text-amber-500 bg-amber-500/20",
  media: "text-blue-500 bg-blue-500/20",
  citizen: "text-green-500 bg-green-500/20",
};

export const REACTION_ICONS: Record<string, React.ElementType> = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown,
};

export const DISCORD_EMOJI_REACTIONS = [
  { name: "ixnay", url: "https://cdn.discordapp.com/emojis/559232409451888640.png" },
  { name: "heky_boi", url: "https://cdn.discordapp.com/emojis/580813300733157376.png" },
  { name: "pog", url: "https://cdn.discordapp.com/emojis/739969522139209748.png" },
];

export function getDiscordEmojiUrl(
  reactionType: string,
  apiEmojis?: Array<{ name: string; url: string }>
): string | null {
  if (!reactionType.startsWith("discord:")) return null;

  const parts = reactionType.split(":");
  const emojiName = parts[1] || "";
  const emojiId = parts[2] || "";

  if (emojiId) {
    return `https://cdn.discordapp.com/emojis/${emojiId}.png`;
  }

  const hardcoded = DISCORD_EMOJI_REACTIONS.find((e) => e.name === emojiName);
  if (hardcoded) return hardcoded.url;
  const fromApi = apiEmojis?.find((e) => e.name === emojiName);
  if (fromApi) return fromApi.url;
  return null;
}

const DISCORD_CDN_HOSTNAMES = ["cdn.discordapp.com", "media.discordapp.net"];

export function proxyDiscordUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url as string);
    if (DISCORD_CDN_HOSTNAMES.includes(parsed.hostname)) {
      return withBasePath(`/api/proxy-discord-image?url=${encodeURIComponent(url as string)}`);
    }
  } catch {}
  if (url.startsWith("/")) {
    let cleanPath = url;
    if (cleanPath.startsWith("/projects/ixstates/")) {
      cleanPath = cleanPath.slice("/projects/ixstates".length);
    } else if (cleanPath.startsWith("/projects/ixstates")) {
      cleanPath = cleanPath.slice("/projects/ixstates".length);
    }
    if (cleanPath.includes("/images/discord/")) {
      cleanPath = cleanPath.includes("?") ? `${cleanPath}&v=1` : `${cleanPath}?v=1`;
    }
    return withBasePath(cleanPath);
  }
  return url;
}

export function RelativeTimestamp({ timestamp }: { timestamp: Date | string | number }) {
  const relativeTime = useRelativeTime(timestamp);
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  return (
    <span
      className="text-muted-foreground cursor-help text-sm"
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
}
