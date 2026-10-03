import React from "react";
import {
  Emoji as Smile,
  Emoji as Angry,
  ThumbsUp,
  ThumbsDown,
  FireFlame as Flame,
  Heart,
  Crown,
  Journal as Newspaper,
  Group as Users,
  User as UserIcon,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { useRelativeTime } from "~/hooks/useRelativeTime";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  government: Crown,
  media: Newspaper,
  citizen: Users,
  personal: UserIcon,
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  government: "text-yellow bg-yellow/20",
  media: "text-blue bg-blue/20",
  citizen: "text-green bg-green/20",
  personal: "text-label-secondary bg-fill-2",
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
  } catch {
    // not an absolute URL — handled as a path below
  }
  if (url.startsWith("/")) {
    let cleanPath = url;
    if (cleanPath.startsWith("/projects/ixstates")) {
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
      className="text-label-secondary text-body cursor-help"
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
}

export const accountTypeColor = (type?: string, fallback = "bg-fill-2 text-label-secondary") =>
  ACCOUNT_TYPE_COLORS[type ?? ""] || fallback;

export function AccountTypeIcon({ type, className }: { type?: string; className?: string }) {
  const Icon = ACCOUNT_TYPE_ICONS[type ?? ""] || Users;
  return <Icon className={className} aria-hidden />;
}

export const getInitials = (name = "U") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

/** Account avatar with an initials fallback tinted by account type. */
export function AccountAvatar({
  account,
  className,
  fallbackClassName,
}: {
  account?: { profileImageUrl?: string | null; displayName?: string; accountType?: string } | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={proxyDiscordUrl(account?.profileImageUrl || "")} />
      <AvatarFallback className={cn(accountTypeColor(account?.accountType), fallbackClassName)}>
        {getInitials(account?.displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
