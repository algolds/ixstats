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
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
  badge?: number;
  iconClassName?: string;
}

/** A compact Halo action: 28px on fine pointers, 44px wide on touch so neighbouring hit areas meet without overlap. */
export function HaloIconButton({
  label,
  icon: Icon,
  onClick,
  badge,
  iconClassName,
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
          className="text-label-secondary hover:text-label hover:bg-fill-4 focus-visible:-outline-offset-2 pointer-coarse:w-11"
        >
          <Icon className={cn("size-3.5", iconClassName)} />
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
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
