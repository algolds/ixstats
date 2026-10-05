import type React from "react";
import * as IconoirIcons from "iconoir-react";
import { cn } from "~/lib/utils";
import type { ChatBadgeDisplay } from "~/lib/vault/public-cosmetics";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

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
  const Icon =
    ((IconoirIcons as Record<string, unknown>)[badge.icon] as IconComponent | undefined) ??
    IconoirIcons.Crown;
  return (
    <Icon aria-hidden className={cn("size-3 shrink-0", className)} style={{ color: badge.color }} />
  );
}
