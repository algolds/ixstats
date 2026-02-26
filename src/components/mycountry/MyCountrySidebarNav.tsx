"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Shield, Crown, Users, Map, LayoutDashboard, Vote } from "lucide-react";
import { cn } from "~/lib/utils";
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";

export type MyCountrySection = "overview" | "executive" | "diplomacy" | "intelligence" | "defense" | "politics" | "map-editor";

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

export function getSectionFromPathname(pathname: string): MyCountrySection {
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

export function MyCountrySidebarNav({ activeSection, onNavigate, variant = "desktop", notifications }: MyCountrySidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child overflow-hidden rounded-xl border border-border bg-card/60 p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const Icon = item.icon;
            const noteCount = notifications?.[item.id] ?? 0;
            const cls = cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            );
            const dot = noteCount > 0 && !isActive && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
            );

            return isControlled ? (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={cls} aria-current={isActive ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
                {dot}
              </button>
            ) : (
              <Link key={item.id} href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
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
      <nav className="flex w-full flex-col gap-1 rounded-xl border border-border bg-card/60 p-1.5 shadow-sm backdrop-blur-lg dark:bg-card/40">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          const noteCount = notifications?.[item.id] ?? 0;
          const cls = cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200",
            isActive
              ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          );
          const badge = noteCount > 0 && (
            <span className={cn(
              "ml-auto inline-flex items-center justify-center rounded-full text-[9px] font-bold leading-none min-w-[16px] h-4 px-1",
              isActive ? "bg-white/25 text-white" : "bg-amber-500 text-white",
            )}>
              {noteCount}
            </span>
          );

          return isControlled ? (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={cls} aria-current={isActive ? "page" : undefined}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
              {badge}
            </button>
          ) : (
            <Link key={item.id} href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
              {badge}
            </Link>
          );
        })}
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <nav className="flex flex-col gap-1.5 rounded-xl border border-border bg-card/60 p-1.5 shadow-sm backdrop-blur-lg dark:bg-card/40">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;
        const noteCount = notifications?.[item.id] ?? 0;

        const iconEl = (
          <div
            className={cn(
              "group/tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-br text-white shadow-md", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px] transition-transform duration-150", !isActive && "group-hover/tip:scale-110")} />
            {noteCount > 0 && !isActive && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
            )}

            {/* Tooltip — appears to the right */}
            <span
              className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100"
            >
              {item.title}
              {/* Arrow */}
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-popover" />
            </span>
          </div>
        );

        return isControlled ? (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            {iconEl}
          </button>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
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
