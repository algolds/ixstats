"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, NavArrowRight as ChevronRight, Xmark, Settings } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { withBasePath } from "~/lib/base-path";
import { useSportsFocus } from "./SportsFocusProvider";
import { getSportTheme } from "~/lib/sports/theming";
import { cn } from "~/lib/utils";

interface SportsCommandBarProps {
  title: string;
  subtitle?: string;
  lobbyHref: string;
  lobbyLabel: string;
  activeSectionLabel?: string;
  sportPreset?: string;
  logo?: string | null;
  color?: string | null;
  onOpenSettings?: () => void;
  canManage?: boolean;
  extraActions?: React.ReactNode;
}

export function SportsCommandBar({
  title,
  subtitle,
  lobbyHref,
  lobbyLabel,
  activeSectionLabel,
  sportPreset,
  logo,
  color,
  onOpenSettings,
  canManage = false,
  extraActions,
}: SportsCommandBarProps) {
  const { focus, clearFocus } = useSportsFocus();
  const theme = getSportTheme(sportPreset);

  return (
    <div className="material-thin z-sticky shadow-floating rounded-card sticky top-[calc(var(--shell-top-offset)-1rem)] mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
      {/* Left: Breadcrumbs & Entity Identity */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={withBasePath(lobbyHref)}
          className="text-label-secondary hover:text-label text-footnote flex items-center gap-1 font-semibold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{lobbyLabel}</span>
        </Link>

        <ChevronRight className="text-label-tertiary h-3 w-3" />

        <div className="flex items-center gap-2">
          <div
            className="rounded-control border-separator text-footnote flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border shadow-inner"
            style={{
              backgroundColor: color ? `${color}20` : "rgba(255,255,255,0.05)",
            }}
          >
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{theme.emoji}</span>
            )}
          </div>
          <span className="text-label text-headline">{title}</span>
        </div>

        {activeSectionLabel && (
          <>
            <ChevronRight className="text-label-tertiary h-3 w-3" />
            <span className="text-label-secondary text-footnote font-medium">
              {activeSectionLabel}
            </span>
          </>
        )}

        {/* Sport Badge */}
        <Badge
          variant="outline"
          className={cn("text-eyebrow hidden px-2 py-0.5 sm:inline-flex", theme.badgeClass)}
        >
          {theme.name}
        </Badge>
      </div>

      {/* Right: Active Focus Indicator & Actions */}
      <div className="flex items-center gap-2">
        {focus && (
          <div className="bg-tint-fill text-tint text-footnote flex items-center gap-2 rounded-full px-3 py-1 font-medium">
            <span className="capitalize">{focus.type} Focus</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear focus"
              onClick={clearFocus}
              title="Clear focus"
              className="size-5 rounded-full"
            >
              <Xmark className="h-3 w-3" />
            </Button>
          </div>
        )}

        {extraActions}

        {canManage && onOpenSettings && (
          <Button variant="secondary" size="sm" onClick={onOpenSettings}>
            <Settings />
            <span>Manage</span>
          </Button>
        )}
      </div>
    </div>
  );
}
