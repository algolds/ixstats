import { resolveChatBadgeIcon } from "~/components/ui/chat-badge-icon";
import { cn } from "~/lib/utils";
import type { ChatBadgeDisplay } from "~/lib/vault/public-cosmetics";

/**
 * A player's equipped Vault chat badge next to their name: the badge icon in the badge's own
 * colour (cosmetic art keeps its palette). Renders nothing when no badge is equipped.
 */
export function CosmeticChatBadge({
  badge,
  className,
}: {
  badge?: ChatBadgeDisplay | null;
  className?: string;
}) {
  if (!badge?.enabled) return null;
  const Icon = resolveChatBadgeIcon(badge.icon);
  return (
    <Icon aria-hidden className={cn("size-3 shrink-0", className)} style={{ color: badge.color }} />
  );
}
