"use client";

import { Globe } from "lucide-react";
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
  conversationSource?: string,
  conversationType?: string
): ResolvedIdentity {
  const source = conversationSource || (folder as string);

  if (source === "diplomatic" || conversationType === "diplomatic") {
    return {
      displayName: userProfile?.country?.name ?? displayName,
      avatar: userProfile?.country?.flag ?? avatarUrl,
      badgeIcon: Globe,
      badgeColor: "text-amber-500",
      sourceLabel: "Diplomatic",
    };
  }

  if (source === "wiki") {
    return {
      displayName: ixnayId?.wikiUsername ?? displayName,
      avatar: null,
    };
  }

  if (source === "forum") {
    return {
      displayName: ixnayId?.forumUsername ?? displayName,
      avatar: avatarUrl,
    };
  }

  return { displayName, avatar: avatarUrl };
}

interface MessagesIdentityBadgeProps {
  identity?: ResolvedIdentity | null;
  size?: "sm" | "md";
}

export function MessagesIdentityBadge({ identity, size = "sm" }: MessagesIdentityBadgeProps) {
  if (!identity) return null;
  if (!identity.badgeIcon && !identity.sourceLabel) return null;

  const Icon = identity.badgeIcon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className={`${iconSize} ${identity.badgeColor ?? "text-muted-foreground"}`} />}
      {identity.sourceLabel && (
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {identity.sourceLabel}
        </span>
      )}
    </span>
  );
}
