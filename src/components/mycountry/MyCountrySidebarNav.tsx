"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Brain, Shield, Crown, Users, Map, LayoutDashboard, Vote, Lock } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  LayoutDashboardIcon,
  CrownIcon,
  UsersIcon,
  BrainIcon,
  ShieldCheckIcon,
  VoteIcon,
  MapIcon,
} from "~/components/ui/icons";
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";
import { usePremium } from "~/hooks/usePremium";
import { stripBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

/** Map section ids to their animated icon counterparts */
const ANIMATED_NAV_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  overview: LayoutDashboardIcon,
  executive: CrownIcon,
  diplomacy: UsersIcon,
  intelligence: BrainIcon,
  defense: ShieldCheckIcon,
  politics: VoteIcon,
  "map-editor": MapIcon,
};

/** Renders the animated icon for a section when available, falling back to the lucide icon */
function NavIcon({
  id,
  fallback: Fallback,
  className,
  size = 16,
}: {
  id: string;
  fallback: LucideIcon;
  className?: string;
  size?: number;
}) {
  const Animated = ANIMATED_NAV_ICONS[id];
  if (Animated) return <Animated size={size} className={className} />;
  return <Fallback className={cn("h-4 w-4", className)} />;
}

const PREMIUM_GATED_SECTIONS: Set<MyCountrySection> = new Set(["intelligence", "defense"]);

export type MyCountrySection =
  | "overview"
  | "executive"
  | "diplomacy"
  | "intelligence"
  | "defense"
  | "politics"
  | "map-editor";

export const NAV_ITEMS: {
  id: MyCountrySection;
  href: string;
  icon: typeof Crown;
  title: string;
  gradient: string;
  activeGlow: string;
}[] = [
  {
    id: "overview",
    href: "/mycountry",
    icon: LayoutDashboard,
    title: "Overview",
    gradient: SECTION_THEME_CLASSES.overview.gradient,
    activeGlow: SECTION_THEME_CLASSES.overview.activeGlow,
  },
  {
    id: "executive",
    href: "/mycountry/executive",
    icon: Crown,
    title: "Executive",
    gradient: SECTION_THEME_CLASSES.executive.gradient,
    activeGlow: SECTION_THEME_CLASSES.executive.activeGlow,
  },
  {
    id: "diplomacy",
    href: "/mycountry/diplomacy",
    icon: Users,
    title: "Diplomacy",
    gradient: SECTION_THEME_CLASSES.diplomacy.gradient,
    activeGlow: SECTION_THEME_CLASSES.diplomacy.activeGlow,
  },
  {
    id: "intelligence",
    href: "/mycountry/intelligence",
    icon: Brain,
    title: "Intelligence",
    gradient: SECTION_THEME_CLASSES.intelligence.gradient,
    activeGlow: SECTION_THEME_CLASSES.intelligence.activeGlow,
  },
  {
    id: "defense",
    href: "/mycountry/defense",
    icon: Shield,
    title: "Defense",
    gradient: SECTION_THEME_CLASSES.defense.gradient,
    activeGlow: SECTION_THEME_CLASSES.defense.activeGlow,
  },
  {
    id: "politics",
    href: "/mycountry/politics",
    icon: Vote,
    title: "Politics",
    gradient: SECTION_THEME_CLASSES.politics.gradient,
    activeGlow: SECTION_THEME_CLASSES.politics.activeGlow,
  },
  {
    id: "map-editor",
    href: "/mycountry/map-editor",
    icon: Map,
    title: "Map Editor",
    gradient: SECTION_THEME_CLASSES["map-editor"].gradient,
    activeGlow: SECTION_THEME_CLASSES["map-editor"].activeGlow,
  },
];

export function getSectionFromPathname(rawPathname: string): MyCountrySection {
  const pathname = stripBasePath(rawPathname);
  if (pathname === "/mycountry" || pathname === "/mycountry/") return "overview";
  for (const item of NAV_ITEMS) {
    if (item.id !== "overview" && pathname.startsWith(item.href)) return item.id;
  }
  return "overview";
}

interface MyCountrySidebarNavProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  /** "desktop" (default) = icon rail with tooltips, "expanded" = icon + label, "mobile" = horizontal pill bar */
  variant?: "desktop" | "expanded" | "mobile";
  /** Notification counts per section — renders indicator dots when > 0 */
  notifications?: Partial<Record<string, number>>;
}

export function MyCountrySidebarNav({
  activeSection,
  onNavigate,
  variant = "desktop",
  notifications,
}: MyCountrySidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;
  const { isPremium } = usePremium();

  // Fetch section visibility settings — hide intelligence/defense when disabled
  const { data: navSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const HIDDEN_SECTIONS = new Set<MyCountrySection>();
  if (navSettings && !navSettings.showIntelligenceTab) HIDDEN_SECTIONS.add("intelligence");
  if (navSettings && !navSettings.showDefenseTab) HIDDEN_SECTIONS.add("defense");

  const visibleItems = NAV_ITEMS.filter((item) => !HIDDEN_SECTIONS.has(item.id));

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child border-border bg-card/60 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {visibleItems.map((item) => {
            const isActive = item.id === activeId;

            const noteCount = notifications?.[item.id] ?? 0;
            const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
            const cls = cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            );
            const dot = noteCount > 0 && !isActive && (
              <span className="ring-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2" />
            );

            return isControlled ? (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon id={item.id} fallback={item.icon} size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
                {isLocked && <Lock className="h-3 w-3 shrink-0 text-yellow-400/70" />}
                {dot}
              </button>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon id={item.id} fallback={item.icon} size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
                {isLocked && <Lock className="h-3 w-3 shrink-0 text-yellow-400/70" />}
                {dot}
              </Link>
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
        {visibleItems.map((item) => {
          const isActive = item.id === activeId;
          const noteCount = notifications?.[item.id] ?? 0;
          const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
          const cls = cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200",
            isActive
              ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          );
          const badge = noteCount > 0 && (
            <span
              className={cn(
                "ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] leading-none font-bold",
                isActive ? "bg-white/25 text-white" : "bg-amber-500 text-white"
              )}
            >
              {noteCount}
            </span>
          );

          return isControlled ? (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cls}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon id={item.id} fallback={item.icon} size={16} className="shrink-0" />
              <span className="truncate">{item.title}</span>
              {isLocked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-yellow-400/70" />}
              {!isLocked && badge}
            </button>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className={cls}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon id={item.id} fallback={item.icon} size={16} className="shrink-0" />
              <span className="truncate">{item.title}</span>
              {isLocked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-yellow-400/70" />}
              {!isLocked && badge}
            </Link>
          );
        })}
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <nav className="border-border bg-card/60 dark:bg-card/40 flex flex-col gap-1.5 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
      {visibleItems.map((item) => {
        const isActive = item.id === activeId;
        const noteCount = notifications?.[item.id] ?? 0;
        const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);

        const iconEl = (
          <div
            className={cn(
              "group/tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-br text-white shadow-md", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <NavIcon
              id={item.id}
              fallback={item.icon}
              size={18}
              className={cn(
                "transition-transform duration-150",
                !isActive && "group-hover/tip:scale-110"
              )}
            />
            {isLocked && (
              <Lock className="absolute -right-0.5 -bottom-0.5 h-3 w-3 text-yellow-400 drop-shadow" />
            )}
            {noteCount > 0 && !isActive && !isLocked && (
              <span className="ring-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2" />
            )}

            {/* Tooltip — appears to the right */}
            <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
              {item.title}
              {isLocked ? " (Premium)" : ""}
              {/* Arrow */}
              <span className="border-r-popover absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent" />
            </span>
          </div>
        );

        return isControlled ? (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            {iconEl}
          </button>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            {iconEl}
          </Link>
        );
      })}
    </nav>
  );
}
