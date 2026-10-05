"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { getSportCssVars } from "~/lib/sports/theming";
import { Inspector } from "~/components/ui/inspector";
import { useSportsFocus } from "./SportsFocusProvider";
import { SportsFocusPanel, sportsFocusTitle } from "./SportsFocusPanel";

interface SportsShellProps {
  children: React.ReactNode;
  /** The page header (title, back link, actions). */
  header?: React.ReactNode;
  heroSection?: React.ReactNode;
  /** Supporting panels shown in the Inspector when nothing is focused (and under the focus). */
  sideContent?: React.ReactNode;
  sideTitle?: string;
  /** Below 1280px the Inspector is a sheet; this opens it for `sideContent`. */
  sideOpen?: boolean;
  onSideOpenChange?: (open: boolean) => void;
  sportPreset?: string;
  className?: string;
}

export function SportsShell({
  children,
  header,
  heroSection,
  sideContent,
  sideTitle = "Details",
  sideOpen = false,
  onSideOpenChange,
  sportPreset,
  className,
}: SportsShellProps) {
  const sportVars = getSportCssVars(sportPreset);
  const { focus, clearFocus } = useSportsFocus();
  const hasInspector = Boolean(focus) || Boolean(sideContent);

  return (
    <div style={sportVars} className={cn("min-h-screen w-full", className)}>
      <div className="mx-auto max-w-[1700px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {header}
        {heroSection}

        <main className="w-full min-w-0">{children}</main>
      </div>

      {hasInspector && (
        <Inspector
          title={focus ? sportsFocusTitle(focus.type) : sideTitle}
          open={Boolean(focus) || sideOpen}
          onOpenChange={(open) => {
            if (open) return;
            clearFocus();
            onSideOpenChange?.(false);
          }}
          className="space-y-4"
        >
          {focus && <SportsFocusPanel sportPreset={sportPreset} />}
          {sideContent}
        </Inspector>
      )}
    </div>
  );
}
