"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Crown,
  Crown as CrownIcon,
  Group as Users,
  CheckSquare as Vote,
  Lock,
  EditPencil as Edit2,
  StatUp as TrendingUp,
  // oxlint-disable-next-line eslint/no-unused-vars
  ShieldCheck,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { usePremium } from "~/hooks/usePremium";
import { stripBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

/** Renders the standard Iconoir icon for a section */
function NavIcon({
  fallback: Fallback,
  className,
}: {
  id?: string;
  fallback: React.ComponentType<{ className?: string }>;
  className?: string;
  size?: number;
}) {
  return <Fallback className={cn("h-4 w-4", className)} />;
}

const PREMIUM_GATED_SECTIONS: Set<MyCountrySection> = new Set(["intelligence", "defense"]);

export type MyCountrySection =
  | "overview"
  | "executive"
  | "economy"
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
    id: "economy",
    href: "/mycountry/economy",
    icon: TrendingUp,
    title: "Economy",
    gradient: "from-emerald-500 to-teal-600",
    activeGlow: "shadow-emerald-500/20",
  },
  {
    id: "diplomacy",
    href: "/mycountry/diplomacy",
    icon: Users,
    title: "Diplomacy",
    gradient: "from-cyan-500 to-cyan-600",
    activeGlow: "shadow-cyan-500/20",
  },
  {
    id: "defense",
    href: "/mycountry/defense",
    icon: Shield,
    title: "Defense",
    gradient: "from-red-500 to-red-600",
    activeGlow: "shadow-red-500/20",
  },
  {
    id: "politics",
    href: "/mycountry/politics",
    icon: Vote,
    title: "Politics",
    gradient: "from-indigo-500 to-indigo-600",
    activeGlow: "shadow-indigo-500/20",
  },
];

export function getSectionFromPathname(rawPathname: string): MyCountrySection {
  const pathname = stripBasePath(rawPathname);
  if (pathname === "/mycountry" || pathname === "/mycountry/") return "overview";
  if (pathname.startsWith("/mycountry/map-editor")) return "map-editor";
  if (pathname.startsWith("/mycountry/executive")) return "executive";
  if (pathname.startsWith("/mycountry/economy")) return "economy";
  if (pathname.startsWith("/mycountry/intelligence")) return "defense";
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

  // Intelligence/Defense are premium sections. Premium members always see them
  // (unlocked). For everyone else they are hidden unless an admin has explicitly
  // enabled the corresponding nav toggle (in which case they show as a locked teaser).
  const HIDDEN_SECTIONS = new Set<MyCountrySection>();
  if (navSettings && !navSettings.showIntelligenceTab && !isPremium)
    HIDDEN_SECTIONS.add("intelligence");
  if (navSettings && !navSettings.showDefenseTab && !isPremium) HIDDEN_SECTIONS.add("defense");

  const visibleItems = NAV_ITEMS.filter((item) => !HIDDEN_SECTIONS.has(item.id));

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    const mobileLogoClass =
      "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-muted-foreground hover:bg-transparent";

    const mobileLogoContent = (
      <>
        <CrownIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="whitespace-nowrap">Overview</span>
        {isPremium && (
          <span className="ml-1 shrink-0 rounded bg-amber-500/10 px-1 text-[9px] font-bold tracking-wider text-amber-500/90 uppercase">
            Premium
          </span>
        )}
      </>
    );

    const mobileLogo = isControlled ? (
      <button
        type="button"
        onClick={() => {
          console.log("MyCountry mobile logo clicked");
          onNavigate("overview");
        }}
        className={mobileLogoClass}
        aria-label="Overview"
      >
        {mobileLogoContent}
      </button>
    ) : (
      <Link href="/mycountry" className={mobileLogoClass} aria-label="Overview">
        {mobileLogoContent}
      </Link>
    );

    const mobileEditButton = (
      <Link
        href="/mycountry/editor"
        className="text-muted-foreground/60 rounded p-1 transition-all duration-150 hover:text-amber-500 active:scale-95"
        title="Edit Country Profile"
      >
        <Edit2 className="h-3 w-3 shrink-0" />
      </Link>
    );

    return (
      <nav className="facet-hierarchy-child border-border bg-card/60 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {mobileLogo}
          {mobileEditButton}
          <div className="h-4 w-px shrink-0 bg-white/10" />
          {visibleItems.map((item) => {
            const isActive = item.id === activeId;

            const noteCount = notifications?.[item.id] ?? 0;
            const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
            const cls = cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 overflow-hidden",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-lg pl-3.5", item.gradient)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            );
            const dot = noteCount > 0 && !isActive && (
              <span className="ring-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2" />
            );

            const content = (
              <>
                {isActive && (
                  <span
                    className={cn(
                      "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r",
                      item.id === "executive"
                        ? "bg-amber-300"
                        : item.id === "diplomacy"
                          ? "bg-cyan-300"
                          : item.id === "politics"
                            ? "bg-indigo-300"
                            : item.id === "intelligence"
                              ? "bg-blue-300"
                              : item.id === "defense"
                                ? "bg-red-300"
                                : "bg-slate-300"
                    )}
                  />
                )}
                <NavIcon id={item.id} fallback={item.icon} size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
                {isLocked && <Lock className="h-3 w-3 shrink-0 text-yellow-400/70" />}
                {dot}
              </>
            );

            return isControlled ? (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={cls}
                aria-current={isActive ? "page" : undefined}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Expanded desktop: icon + label sidebar ── */
  if (variant === "expanded") {
    const logoContainerClass =
      "flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs font-medium mb-1.5 border-b border-white/5 text-muted-foreground";

    const logoLinkClass =
      "relative flex items-center gap-2 cursor-pointer py-1 text-muted-foreground hover:text-muted-foreground hover:bg-transparent";

    const logoLinkContent = (
      <>
        <CrownIcon className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="truncate font-semibold">MyCountry</span>
        {isPremium && (
          <span className="ml-1 shrink-0 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold tracking-wider text-amber-500/95 uppercase">
            Premium
          </span>
        )}
      </>
    );

    const logoLink = isControlled ? (
      <button
        type="button"
        onClick={() => {
          onNavigate("overview");
        }}
        className={logoLinkClass}
      >
        {logoLinkContent}
      </button>
    ) : (
      <Link href="/mycountry" className={logoLinkClass}>
        {logoLinkContent}
      </Link>
    );

    const editButton = (
      <Link
        href="/mycountry/editor"
        className="text-muted-foreground/60 rounded-md p-1.5 transition-all duration-150 hover:bg-white/10 hover:text-amber-500 active:scale-95 dark:hover:bg-white/5"
        title="Edit Country Profile"
      >
        <Edit2 className="h-3.5 w-3.5 shrink-0" />
      </Link>
    );

    return (
      <nav className="border-border bg-card/60 dark:bg-card/40 animate-fade-in flex w-full flex-col gap-1 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
        <div className={logoContainerClass}>
          {logoLink}
          {editButton}
        </div>
        {visibleItems.map((item) => {
          const isActive = item.id === activeId;
          const noteCount = notifications?.[item.id] ?? 0;
          const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);
          const cls = cn(
            "relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200 overflow-hidden",
            isActive
              ? cn("bg-gradient-to-r text-white shadow-lg pl-3.5", item.gradient, item.activeGlow)
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

          const content = (
            <>
              {isActive && (
                <span
                  className={cn(
                    "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r",
                    item.id === "executive"
                      ? "bg-amber-300"
                      : item.id === "diplomacy"
                        ? "bg-cyan-300"
                        : item.id === "politics"
                          ? "bg-indigo-300"
                          : item.id === "intelligence"
                            ? "bg-blue-300"
                            : item.id === "defense"
                              ? "bg-red-300"
                              : "bg-slate-300"
                  )}
                />
              )}
              <NavIcon id={item.id} fallback={item.icon} size={16} className="shrink-0" />
              <span className="truncate">{item.title}</span>
              {isLocked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-yellow-400/70" />}
              {!isLocked && badge}
            </>
          );

          return isControlled ? (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cls}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </button>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className={cls}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  const logoRailClass =
    "group/logo relative flex h-9 w-9 items-center justify-center rounded-lg border-b border-white/5 pb-1.5 mb-1.5 outline-none cursor-pointer text-muted-foreground/80 hover:text-muted-foreground/80 hover:bg-transparent";

  const logoRailContent = (
    <>
      <CrownIcon className="h-4 w-4 text-amber-500 transition-transform duration-150" />
      {/* Tooltip ── appears to the right */}
      <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full z-50 ml-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/logo:opacity-100">
        <span>Overview</span>
        {isPremium && (
          <span className="rounded bg-amber-500/15 px-1 text-[10px] font-bold tracking-wider text-amber-500 uppercase">
            Premium
          </span>
        )}
        {/* Arrow */}
        <span className="border-r-popover absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent" />
      </span>
    </>
  );

  const logoRailHeader = isControlled ? (
    <button
      type="button"
      onClick={() => {
        console.log("MyCountry rail logo clicked");
        onNavigate("overview");
      }}
      className={logoRailClass}
      aria-label="Overview"
    >
      {logoRailContent}
    </button>
  ) : (
    <Link href="/mycountry" className={logoRailClass} aria-label="Overview">
      {logoRailContent}
    </Link>
  );

  const editRailIcon = (
    <Link
      href="/mycountry/editor"
      className="group/edit text-muted-foreground/65 hover:bg-muted relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:text-amber-500"
      aria-label="Edit Country Profile"
    >
      <Edit2 className="h-4 w-4 transition-transform duration-150 group-hover/edit:scale-110" />
      {/* Tooltip — appears to the right */}
      <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/edit:opacity-100">
        Edit Profile
        {/* Arrow */}
        <span className="border-r-popover absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent" />
      </span>
    </Link>
  );

  return (
    <nav className="border-border bg-card/60 dark:bg-card/40 flex flex-col items-center gap-1.5 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
      {logoRailHeader}
      {editRailIcon}
      {visibleItems.map((item) => {
        const isActive = item.id === activeId;
        const noteCount = notifications?.[item.id] ?? 0;
        const isLocked = !isPremium && PREMIUM_GATED_SECTIONS.has(item.id);

        const iconEl = (
          <div
            className={cn(
              "group/tip relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-br pl-1 text-white shadow-lg", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {isActive && (
              <span
                className={cn(
                  "absolute top-1 bottom-1 left-0 w-0.5 rounded-r-sm",
                  item.id === "executive"
                    ? "bg-amber-300"
                    : item.id === "diplomacy"
                      ? "bg-cyan-300"
                      : item.id === "politics"
                        ? "bg-indigo-300"
                        : item.id === "intelligence"
                          ? "bg-blue-300"
                          : item.id === "defense"
                            ? "bg-red-300"
                            : "bg-slate-300"
                )}
              />
            )}
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
