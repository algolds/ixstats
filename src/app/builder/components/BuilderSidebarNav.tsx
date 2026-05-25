"use client";

import { cn } from "~/lib/utils";
import {
  Globe,
  Flag,
  Building2,
  TrendingUp,
  CheckCircle,
  Lock,
  Check,
  type LucideIcon,
} from "lucide-react";
import { type BuilderSection, BUILDER_SECTION_THEMES, BUILD_STEPS } from "../lib/builder-theme";

// ─── Nav item config ───

interface BuilderNavItem {
  id: BuilderSection;
  icon: LucideIcon;
  title: string;
  shortTitle: string;
  gradient: string;
  activeGlow: string;
}

// Only include build steps - no welcome/import
const NAV_ITEMS: BuilderNavItem[] = [
  {
    id: "foundation",
    icon: Globe,
    title: "Foundation",
    shortTitle: "Found.",
    gradient: BUILDER_SECTION_THEMES.foundation.gradient,
    activeGlow: BUILDER_SECTION_THEMES.foundation.activeGlow,
  },
  {
    id: "identity",
    icon: Flag,
    title: "National Identity",
    shortTitle: "Identity",
    gradient: BUILDER_SECTION_THEMES.identity.gradient,
    activeGlow: BUILDER_SECTION_THEMES.identity.activeGlow,
  },
  {
    id: "government",
    icon: Building2,
    title: "Government",
    shortTitle: "Govt.",
    gradient: BUILDER_SECTION_THEMES.government.gradient,
    activeGlow: BUILDER_SECTION_THEMES.government.activeGlow,
  },
  {
    id: "economics",
    icon: TrendingUp,
    title: "Economics",
    shortTitle: "Econ.",
    gradient: BUILDER_SECTION_THEMES.economics.gradient,
    activeGlow: BUILDER_SECTION_THEMES.economics.activeGlow,
  },
  {
    id: "preview",
    icon: CheckCircle,
    title: "Preview & Create",
    shortTitle: "Preview",
    gradient: BUILDER_SECTION_THEMES.preview.gradient,
    activeGlow: BUILDER_SECTION_THEMES.preview.activeGlow,
  },
];

// ─── Props ───

interface BuilderSidebarNavProps {
  activeSection: BuilderSection;
  onNavigate: (section: BuilderSection) => void;
  /** Which build steps have been completed */
  completedSteps?: Set<BuilderSection>;
  /** Which steps the user can currently access */
  accessibleSteps?: Set<BuilderSection>;
  variant?: "desktop" | "expanded" | "mobile";
}

// ─── Component ───

export function BuilderSidebarNav({
  activeSection,
  onNavigate,
  completedSteps = new Set(),
  accessibleSteps,
  variant = "desktop",
}: BuilderSidebarNavProps) {
  const isAccessible = (id: BuilderSection) => {
    if (!accessibleSteps) return true;
    return accessibleSteps.has(id);
  };

  const stepIndex = (id: BuilderSection) => BUILD_STEPS.indexOf(id);

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child border-border bg-card/60 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeSection;
            const accessible = isAccessible(item.id);
            const completed = completedSteps.has(item.id);
            const isBuildStep = stepIndex(item.id) >= 0;

            return (
              <button
                key={item.id}
                onClick={() => accessible && onNavigate(item.id)}
                disabled={!accessible}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                  isActive
                    ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                    : accessible
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "text-muted-foreground/40 cursor-not-allowed"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{item.shortTitle}</span>
                {!accessible && <Lock className="text-muted-foreground/40 h-3 w-3 shrink-0" />}
                {completed && isBuildStep && !isActive && (
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Expanded desktop: icon + label sidebar ── */
  if (variant === "expanded") {
    return (
      <nav className="border-border bg-card/60 dark:bg-card/40 flex w-full flex-col gap-1 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeSection;
          const accessible = isAccessible(item.id);
          const completed = completedSteps.has(item.id);
          const isBuildStep = stepIndex(item.id) >= 0;

          return (
            <button
              key={item.id}
              onClick={() => accessible && onNavigate(item.id)}
              disabled={!accessible}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200",
                isActive
                  ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
                  : accessible
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "text-muted-foreground/40 cursor-not-allowed"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon size={16} className="shrink-0" />
              <span className="truncate">{item.title}</span>
              {!accessible && (
                <Lock className="text-muted-foreground/40 ml-auto h-3.5 w-3.5 shrink-0" />
              )}
              {completed && isBuildStep && !isActive && accessible && (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" />
              )}
              {isBuildStep && accessible && !completed && !isActive && (
                <span className="text-muted-foreground/50 ml-auto text-[10px]">
                  {stepIndex(item.id) + 1}/{BUILD_STEPS.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <nav className="border-border bg-card/60 dark:bg-card/40 flex flex-col gap-1.5 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeSection;
        const accessible = isAccessible(item.id);
        const completed = completedSteps.has(item.id);
        const isBuildStep = stepIndex(item.id) >= 0;

        return (
          <button
            key={item.id}
            onClick={() => accessible && onNavigate(item.id)}
            disabled={!accessible}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            <div
              className={cn(
                "group/tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? cn("bg-gradient-to-br text-white shadow-md", item.gradient, item.activeGlow)
                  : accessible
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "text-muted-foreground/30 cursor-not-allowed"
              )}
            >
              <item.icon
                size={18}
                className={cn(
                  "transition-transform duration-150",
                  !isActive && accessible && "group-hover/tip:scale-110"
                )}
              />
              {/* Completion check */}
              {completed && isBuildStep && !isActive && (
                <span className="ring-background absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2">
                  <Check className="h-2 w-2 text-white" />
                </span>
              )}
              {/* Lock indicator */}
              {!accessible && (
                <Lock className="text-muted-foreground/50 absolute -right-0.5 -bottom-0.5 h-3 w-3 drop-shadow" />
              )}

              {/* Tooltip */}
              <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
                {item.title}
                {!accessible ? " (locked)" : ""}
                <span className="border-r-popover absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent" />
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

export { NAV_ITEMS };
export type { BuilderNavItem };
