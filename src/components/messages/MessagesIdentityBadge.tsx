"use client";

import { Globe, BookOpen, MessageCircle } from "lucide-react";
import type { MessageFolder } from "~/types/messages";
import type { ResolvedIdentity } from "~/types/messages";

interface UserProfile {
  country?: {
    name: string;
    slug: string;
    flag?: string | null;
  } | null;
}

interface IxnayIdData {
  wikiUsername?: string | null;
  forumUsername?: string | null;
  discordUsername?: string | null;
}

/**
 * Resolves the display identity based on the conversation's folder context.
 * Diplomatic channels show country name, wiki discussions show wiki username, etc.
 */
export function resolveIdentity(
  displayName: string,
  avatarUrl: string | null,
  folder: MessageFolder,
  userProfile?: UserProfile | null,
  ixnayId?: IxnayIdData | null,
  conversationSource?: string
): ResolvedIdentity {
  switch (folder) {
    case "diplomatic":
      return {
        displayName: userProfile?.country?.name ?? displayName,
        avatar: userProfile?.country?.flag ?? avatarUrl,
        badgeIcon: Globe,
        badgeColor: "text-amber-500",
        sourceLabel: "Diplomatic",
      };

    case "discussions":
      if (conversationSource === "wiki" && ixnayId?.wikiUsername) {
        return {
          displayName: ixnayId.wikiUsername,
          avatar: null,
          badgeIcon: BookOpen,
          badgeColor: "text-purple-500",
          sourceLabel: "Wiki",
        };
      }
      if (conversationSource === "forum" && ixnayId?.forumUsername) {
        return {
          displayName: ixnayId.forumUsername,
          avatar: avatarUrl,
          badgeIcon: MessageCircle,
          badgeColor: "text-orange-500",
          sourceLabel: "Forum",
        };
      }
      return { displayName, avatar: avatarUrl, sourceLabel: "Discussion" };

    case "groups":
    case "personal":
    case "inbox":
    case "system":
    default:
      return { displayName, avatar: avatarUrl };
  }
}

interface MessagesIdentityBadgeProps {
  identity?: ResolvedIdentity | null;
  size?: "sm" | "md";
}

export function MessagesIdentityBadge({
  identity,
  size = "sm",
}: MessagesIdentityBadgeProps) {
  if (!identity) return null;
  if (!identity.badgeIcon && !identity.sourceLabel) return null;

  const Icon = identity.badgeIcon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className={`${iconSize} ${identity.badgeColor ?? "text-muted-foreground"}`} />}
      {identity.sourceLabel && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {identity.sourceLabel}
        </span>
      )}
    </span>
  );
}
