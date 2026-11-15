import React from "react";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

const BADGE_CAP = 99;

/** Two digits fit the 16px pill; anything larger reads as a cap rather than growing it. */
export function formatBadgeCount(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

interface HaloIconButtonProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional circular avatar image URL rendered instead of `icon` (e.g. Clerk portrait). */
  iconSrc?: string | null;
  onClick: () => void;
  badge?: number;
  iconClassName?: string;
  /** The view this button opens; marks it as a dialog trigger and the target for focus return. */
  triggerFor?: string;
  /** Optional platform shortcut hint rendered inside the tooltip (`⌘K`, `⌘,`). */
  shortcut?: string;
  /** Toggle disclosure state for non-dialog popovers such as `NavTray`. */
  expanded?: boolean;
}

/** A compact Halo action: 28px on fine pointers, 44px wide on touch so neighbouring hit areas meet without overlap. */
export function HaloIconButton({
  label,
  icon: Icon,
  iconSrc,
  onClick,
  badge,
  iconClassName,
  triggerFor,
  shortcut,
  expanded,
}: HaloIconButtonProps) {
  const unread = badge ?? 0;
  const hasBadge = unread > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          aria-label={hasBadge ? `${label}, ${unread} unread` : label}
          aria-haspopup={triggerFor && expanded === undefined ? "dialog" : undefined}
          aria-expanded={expanded}
          data-halo-trigger={triggerFor}
          className="text-label-secondary hover:text-label hover:bg-fill-4 focus-visible:-outline-offset-2 pointer-coarse:w-11"
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              className={cn(
                "ring-separator size-4 rounded-full object-cover ring-1",
                iconClassName
              )}
            />
          ) : (
            <Icon className={cn("size-3.5", iconClassName)} />
          )}
          {hasBadge && (
            <span
              aria-hidden="true"
              data-slot="halo-badge"
              className="bg-yellow text-on-yellow text-caption absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-center leading-4 font-semibold tabular-nums"
            >
              {formatBadgeCount(unread)}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {shortcut ? (
          <span className="inline-flex items-center gap-1.5">
            <span>{label}</span>
            <kbd className="text-label-tertiary font-sans">{shortcut}</kbd>
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  );
}
