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

export interface SportsCommandBarProps {
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
    <div className="facet-hierarchy-parent sticky top-16 z-30 mb-4 flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/75 p-3.5 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      {/* Left: Breadcrumbs & Entity Identity */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={withBasePath(lobbyHref)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{lobbyLabel}</span>
        </Link>

        <ChevronRight className="text-muted-foreground/40 h-3 w-3" />

        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/40 text-xs shadow-inner"
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
          <span className="text-foreground text-sm font-bold tracking-tight">{title}</span>
        </div>

        {activeSectionLabel && (
          <>
            <ChevronRight className="text-muted-foreground/40 h-3 w-3" />
            <span className="text-muted-foreground text-xs font-medium">{activeSectionLabel}</span>
          </>
        )}

        {/* Sport Badge */}
        <Badge
          variant="outline"
          className={cn("hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", theme.badgeClass)}
        >
          {theme.name}
        </Badge>
      </div>

      {/* Right: Active Focus Indicator & Actions */}
      <div className="flex items-center gap-2">
        {focus && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 backdrop-blur-md">
            <span className="capitalize">{focus.type} Focus</span>
            <button
              type="button"
              onClick={clearFocus}
              className="hover:text-amber-200 cursor-pointer rounded-full p-0.5 transition"
              title="Clear Focus"
            >
              <Xmark className="h-3 w-3" />
            </button>
          </div>
        )}

        {extraActions}

        {canManage && onOpenSettings && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            data-cuelume-press="subtle"
            className="border-border/50 bg-card/60 h-8 cursor-pointer text-xs font-semibold hover:bg-muted/40 active:scale-[0.98]"
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            <span>Manage</span>
          </Button>
        )}
      </div>
    </div>
  );
}
