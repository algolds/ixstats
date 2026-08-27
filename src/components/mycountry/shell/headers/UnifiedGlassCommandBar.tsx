"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ViewGrid as LayoutGrid,
  // oxlint-disable-next-line eslint/no-unused-vars
  HistoricShieldAlt as HistoricShield,
  // oxlint-disable-next-line eslint/no-unused-vars
  StatUp as TrendingUp,
  KeyCommand as Command,
  EditPencil as Edit3,
  User,
  ArrowUpRight,
} from "iconoir-react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { FacetContainer, FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useTheme } from "~/context/theme-context";
import { soundEffects } from "~/lib/sound/cuelume";
import { DOMAIN_TILES } from "../ExecutiveHome";
import type { CommandNavMode } from "../CommandNavToggle";

interface UnifiedGlassCommandBarProps {
  mode: CommandNavMode;
  activeSection: string;
  onChangeMode: (mode: CommandNavMode) => void;
  onNavigate?: (section: any) => void;
  onDeclare?: () => void;
}

export function UnifiedGlassCommandBar({
  mode,
  activeSection,
  onChangeMode,
  onNavigate,
  onDeclare,
}: UnifiedGlassCommandBarProps) {
  const router = useRouter();
  // oxlint-disable-next-line eslint/no-unused-vars
  const { compactMode } = useTheme();
  const { country } = useCountryData();

  const profileHref = country?.slug ? `/countries/${country.slug}` : "/countries";

  const isExecutiveMode = mode === "executive";
  const isOverview = !isExecutiveMode && (activeSection === "overview" || !activeSection);

  return (
    <FacetContainer
      depth={2}
      interactive="none"
      enableRefraction={false}
      className="border-border/80 bg-card/80 dark:bg-card/40 relative flex w-full flex-col gap-3.5 rounded-2xl border p-3.5 shadow-xl backdrop-blur-xl transition-all duration-200 dark:border-white/15"
    >
      {/* Top Executive Navigation Row */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand Identity & Prominent Logo */}
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center px-1 py-0.5">
            <MyCountryLogo size="md" variant="full" animated={true} />
          </div>
        </div>

        {/* Right: Statecraft Actions & Tools */}
        <div className="flex items-center gap-2">
          {/* Public Profile Button */}
          <Link
            href={profileHref}
            className="text-muted-foreground hover:text-foreground hover:bg-card/80 flex items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-1.5 text-xs font-semibold transition-all hover:border-white/10 active:scale-[0.98]"
            title="Open Sovereign Public Profile"
            onClick={() => soundEffects.press()}
          >
            <User className="h-3.5 w-3.5" />
            <span>Profile</span>
          </Link>

          {/* Map Editor Tool */}
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              router.push("/mycountry/editor");
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-card/80 flex cursor-pointer items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-1.5 text-xs font-semibold transition-all hover:border-white/10 active:scale-[0.98]"
            title="Open Territory Map Editor"
          >
            <Edit3 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Editor</span>
          </button>

          {/* Primary Action Button: Declare a Directive */}
          <button
            type="button"
            onClick={() => {
              soundEffects.bloom();
              if (onDeclare) {
                onDeclare();
              } else {
                onChangeMode("executive");
              }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all duration-200 select-none active:scale-[0.98]",
              isExecutiveMode
                ? "border-amber-500/50 bg-amber-500 font-extrabold text-black shadow-md"
                : "border-amber-500/40 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-300 dark:hover:bg-amber-500/20"
            )}
          >
            <Command className="h-3.5 w-3.5" />
            <span>Declare Directive</span>
          </button>
        </div>
      </div>

      {/* Integrated Lower Deck: The 4 Domain Action Tiles (on Overview) or Segmented Domain Switcher (on Domain Sub-surfaces) */}
      {isOverview ? (
        <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
          {DOMAIN_TILES.map(({ id, title, icon: Icon, graphic: Graphic, badgeCls, getPeek }) => (
            <FacetCard
              key={id}
              depth={1}
              interactive="none"
              onClick={() => {
                soundEffects.press();
                onNavigate?.(id);
              }}
              className="group border-border/70 bg-card/60 hover:border-border hover:bg-card/90 relative flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl border p-2.5 shadow-xs backdrop-blur-md transition-all duration-150 select-none active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
            >
              {/* Subtle Natural Architectural Watermark */}
              <Graphic />

              {/* Left: Themed Icon Badge + Text */}
              <div className="relative z-10 flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-transform duration-150 group-hover:scale-105",
                    badgeCls
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 text-left">
                  <span className="text-foreground truncate text-xs leading-tight font-bold tracking-tight">
                    {title}
                  </span>
                  <span className="text-muted-foreground truncate text-[10px] leading-tight font-medium tracking-tight">
                    {getPeek(country)}
                  </span>
                </div>
              </div>

              {/* Right: Arrow indicator */}
              <ArrowUpRight className="text-muted-foreground group-hover:text-foreground relative z-10 h-3 w-3 shrink-0 opacity-60 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </FacetCard>
          ))}
        </div>
      ) : (
        /* Domain Sub-surface Breadcrumb & Switcher Strip */
        <div className="bg-muted/40 flex items-center justify-between rounded-xl p-1 backdrop-blur-md dark:bg-white/[0.04]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                onChangeMode("home");
                onNavigate?.("overview");
              }}
              className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.25 text-xs font-semibold transition-all hover:bg-white/5 active:scale-[0.98]"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Overview</span>
            </button>
            <span className="text-muted-foreground/40 text-xs">/</span>
            // oxlint-disable-next-line eslint/no-unused-vars
            {DOMAIN_TILES.map(({ id, title, icon: Icon, badgeCls }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    soundEffects.press();
                    if (isExecutiveMode) {
                      onChangeMode("home");
                    }
                    onNavigate?.(id);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.25 text-xs font-semibold transition-all select-none active:scale-[0.98]",
                    isActive
                      ? "bg-card text-foreground border-border/70 border font-bold shadow-xs dark:border-white/15 dark:bg-white/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </FacetContainer>
  );
}
