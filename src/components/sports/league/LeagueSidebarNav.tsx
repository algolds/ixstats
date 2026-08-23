"use client";

import { Dashboard as LayoutDashboard, Trophy, Calendar, Tournament as Swords, MapPin, Group as Users, Shield, Medal } from "iconoir-react";
import { cn } from "~/lib/utils";
import { getSportEmoji } from "~/lib/sports/presets";
import { Progress } from "~/components/ui/progress";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

export type LeagueSection =
  | "overview"
  | "standings"
  | "schedule"
  | "bracket"
  | "races"
  | "draft"
  | "sim"
  | "teams"
  | "history";

export const NAV_ITEMS: {
  id: LeagueSection;
  icon: typeof LayoutDashboard;
  title: string;
  gradient: string;
  activeGlow: string;
  activeLine: string;
}[] = [
  {
    id: "overview",
    icon: LayoutDashboard,
    title: "Overview",
    gradient: "from-slate-500/80 to-slate-600/80",
    activeGlow: "shadow-slate-500/20",
    activeLine: "bg-slate-300",
  },
  {
    id: "standings",
    icon: Trophy,
    title: "Standings",
    gradient: "from-blue-500/80 to-blue-600/80",
    activeGlow: "shadow-blue-500/20",
    activeLine: "bg-blue-300",
  },
  {
    id: "schedule",
    icon: Calendar,
    title: "Schedule",
    gradient: "from-cyan-500/80 to-cyan-600/80",
    activeGlow: "shadow-cyan-500/20",
    activeLine: "bg-cyan-300",
  },
  {
    id: "bracket",
    icon: Swords,
    title: "Bracket",
    gradient: "from-red-500/80 to-red-600/80",
    activeGlow: "shadow-red-500/20",
    activeLine: "bg-red-300",
  },
  {
    id: "races",
    icon: MapPin,
    title: "Races",
    gradient: "from-orange-500/80 to-orange-600/80",
    activeGlow: "shadow-orange-500/20",
    activeLine: "bg-orange-300",
  },
  {
    id: "draft",
    icon: Users,
    title: "Draft",
    gradient: "from-emerald-500/80 to-emerald-600/80",
    activeGlow: "shadow-emerald-500/20",
    activeLine: "bg-emerald-300",
  },

  {
    id: "teams",
    icon: Shield,
    title: "Teams",
    gradient: "from-amber-500/80 to-amber-600/80",
    activeGlow: "shadow-amber-500/20",
    activeLine: "bg-amber-300",
  },
  {
    id: "history",
    icon: Medal,
    title: "History",
    gradient: "from-violet-500/80 to-violet-600/80",
    activeGlow: "shadow-violet-500/20",
    activeLine: "bg-violet-300",
  },
];

interface LeagueSidebarNavProps {
  activeSection: LeagueSection;
  onNavigate: (section: LeagueSection) => void;
  variant?: "desktop" | "expanded" | "mobile";
  notifications?: Partial<Record<LeagueSection, number>>;
  visibleSections?: LeagueSection[];
  sportAccent?: string;
  sportHighlight?: string;
}

export function LeagueSidebarNav({
  activeSection,
  onNavigate,
  variant = "desktop",
  notifications,
  visibleSections,
  sportAccent,
  sportHighlight,
}: LeagueSidebarNavProps) {
  const activeId = activeSection;

  const filteredItems = visibleSections
    ? NAV_ITEMS.filter((item) => visibleSections.includes(item.id))
    : NAV_ITEMS;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="facet-hierarchy-child border-border bg-card/60 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {filteredItems.map((item) => {
            const isActive = item.id === activeId;
            const noteCount = notifications?.[item.id] ?? 0;
            const cls = cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 overflow-hidden",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-lg pl-3.5", !sportAccent && item.gradient)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            );
            const dot = noteCount > 0 && !isActive && (
              <span className="ring-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2" />
            );

            const activeStyle =
              isActive && sportAccent
                ? {
                    background: sportHighlight
                      ? `linear-gradient(to right, hsl(${sportAccent} / 0.8), hsl(${sportHighlight} / 0.8))`
                      : `linear-gradient(to right, hsl(${sportAccent} / 0.8), hsl(${sportAccent} / 0.6))`,
                    boxShadow: `0 4px 12px hsl(${sportAccent} / 0.25)`,
                  }
                : undefined;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={cls}
                aria-current={isActive ? "page" : undefined}
                style={activeStyle}
              >
                {isActive && (
                  <span
                    className={cn(
                      "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r",
                      !sportAccent && item.activeLine
                    )}
                    style={sportAccent ? { backgroundColor: `hsl(${sportAccent})` } : undefined}
                  />
                )}
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
                {dot}
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
      <nav className="border-border bg-card/60 dark:bg-card/40 animate-fade-in flex w-full flex-col gap-1 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
        {filteredItems.map((item) => {
          const isActive = item.id === activeId;
          const noteCount = notifications?.[item.id] ?? 0;
          const cls = cn(
            "relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200 overflow-hidden",
            isActive
              ? cn(
                  "bg-gradient-to-r text-white shadow-lg pl-3.5",
                  !sportAccent && item.gradient,
                  !sportAccent && item.activeGlow
                )
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

          const activeStyle =
            isActive && sportAccent
              ? {
                  background: sportHighlight
                    ? `linear-gradient(to right, hsl(${sportAccent} / 0.8), hsl(${sportHighlight} / 0.8))`
                    : `linear-gradient(to right, hsl(${sportAccent} / 0.8), hsl(${sportAccent} / 0.6))`,
                  boxShadow: `0 4px 12px hsl(${sportAccent} / 0.25)`,
                }
              : undefined;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cls}
              aria-current={isActive ? "page" : undefined}
              style={activeStyle}
            >
              {isActive && (
                <span
                  className={cn(
                    "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r",
                    !sportAccent && item.activeLine
                  )}
                  style={sportAccent ? { backgroundColor: `hsl(${sportAccent})` } : undefined}
                />
              )}
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
              {badge}
            </button>
          );
        })}
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <nav className="border-border bg-card/60 dark:bg-card/40 flex flex-col items-center gap-1.5 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
      {filteredItems.map((item) => {
        const isActive = item.id === activeId;
        const noteCount = notifications?.[item.id] ?? 0;

        const activeStyle =
          isActive && sportAccent
            ? {
                background: sportHighlight
                  ? `linear-gradient(to right, hsl(${sportAccent} / 0.8), hsl(${sportHighlight} / 0.8))`
                  : `linear-gradient(to right, hsl(${sportAccent} / 0.8), hsl(${sportAccent} / 0.6))`,
                boxShadow: `0 4px 12px hsl(${sportAccent} / 0.25)`,
              }
            : undefined;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          >
            <div
              className={cn(
                "group/tip relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg transition-all duration-200",
                isActive
                  ? cn(
                      "bg-gradient-to-br pl-1 text-white shadow-lg",
                      !sportAccent && item.gradient,
                      !sportAccent && item.activeGlow
                    )
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={activeStyle}
            >
              {isActive && (
                <span
                  className={cn(
                    "absolute top-1 bottom-1 left-0 w-0.5 rounded-r-sm",
                    !sportAccent && item.activeLine
                  )}
                  style={sportAccent ? { backgroundColor: `hsl(${sportAccent})` } : undefined}
                />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 transition-transform duration-150",
                  !isActive && "group-hover/tip:scale-110"
                )}
              />
              {noteCount > 0 && !isActive && (
                <span className="ring-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2" />
              )}

              {/* Tooltip */}
              <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
                {item.title}
                <span className="border-r-popover absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent" />
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

/* ──── LeagueBrandCard ──── */

interface LeagueBrandCardProps {
  sportPreset: string;
  leagueName: string;
  archetype: string;
  teamCount: number;
  logo?: string | null;
  seasonNumber?: number;
  completedCount?: number;
  totalCount?: number;
  progressLabel?: string;
}

export function LeagueBrandCard({
  sportPreset,
  leagueName,
  archetype,
  teamCount,
  logo,
  seasonNumber,
  completedCount,
  totalCount,
  progressLabel = "matches",
}: LeagueBrandCardProps) {
  const emoji = getSportEmoji(sportPreset);
  const pct =
    totalCount && totalCount > 0 ? Math.round(((completedCount ?? 0) / totalCount) * 100) : 0;

  return (
    <div className="border-border bg-card/60 dark:bg-card/40 rounded-xl border p-3 shadow-sm backdrop-blur-lg">
      <div className="mb-2 flex items-center gap-2">
        {logo ? (
          <img
            src={withBasePath(logo)}
            alt={leagueName}
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl">
            {emoji}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{leagueName}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">
              {archetype}
            </span>
          </div>
        </div>
      </div>
      <div className="text-muted-foreground text-[11px]">
        {teamCount} {teamCount === 1 ? "team" : "teams"}
      </div>

      {seasonNumber !== undefined && completedCount !== undefined && totalCount !== undefined && (
        <div className="border-border/10 mt-3 border-t pt-2.5">
          <div className="mb-1 flex items-baseline justify-between text-[10px]">
            <span className="text-muted-foreground font-semibold">
              Season {seasonNumber} Progress
            </span>
            <span className="text-foreground/90 font-mono font-bold">
              {completedCount}/{totalCount} {progressLabel} ({pct}%)
            </span>
          </div>
          <Progress value={pct} className="h-1" />
        </div>
      )}
    </div>
  );
}

/* ──── ReigningChampionWidget ──── */

interface ReigningChampionWidgetProps {
  championName: string;
  seasonNumber: number;
}

export function ReigningChampionWidget({
  championName,
  seasonNumber,
}: ReigningChampionWidgetProps) {
  return (
    <div className="border-border bg-card/60 dark:bg-card/40 relative overflow-hidden rounded-xl border p-3 shadow-sm backdrop-blur-lg">
      <div className="absolute top-0 right-0 -mt-1 -mr-1 text-amber-400/20">
        <Trophy className="h-12 w-12" />
      </div>
      <div className="relative">
        <div className="mb-1 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
            Season {seasonNumber} Title
          </span>
        </div>
        <p className="truncate text-sm font-semibold">{championName}</p>
      </div>
    </div>
  );
}

/* ──── RewardsBannerWidget ──── */

interface RewardsBannerWidgetProps {
  packCount: number;
}

export function RewardsBannerWidget({ packCount }: RewardsBannerWidgetProps) {
  if (packCount === 0) return null;

  return (
    <a
      href="/vault/marketplace?tab=store"
      className="group relative block overflow-hidden rounded-xl border border-transparent bg-gradient-to-r from-purple-600/20 via-fuchsia-500/20 to-cyan-400/20 p-3 shadow-sm backdrop-blur-lg transition-all duration-300 hover:scale-[1.02]"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600/10 via-fuchsia-500/10 to-cyan-400/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-purple-500/25">
          {packCount}
        </span>
        <div>
          <p className="text-xs font-semibold">
            {packCount} unopened card pack{packCount !== 1 ? "s" : ""}
          </p>
          <p className="text-muted-foreground text-[10px]">Open in IxVault Market</p>
        </div>
      </div>
    </a>
  );
}

/* ──── Connected RewardsBanner using tRPC ──── */

export function RewardsBanner() {
  const { data } = api.cardPacks.getMyPacks.useQuery({ isOpened: false });
  const packCount = data?.packs?.length ?? 0;

  return <RewardsBannerWidget packCount={packCount} />;
}
