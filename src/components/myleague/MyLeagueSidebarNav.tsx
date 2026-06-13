"use client";

import { LayoutDashboard, Users, Shield, ArrowLeftRight, Landmark } from "lucide-react";
import { cn } from "~/lib/utils";

export type MyLeagueSection = "overview" | "roster" | "tactics" | "transfers" | "management";

export const NAV_ITEMS: {
  id: MyLeagueSection;
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
    id: "roster",
    icon: Users,
    title: "Roster",
    gradient: "from-blue-500/80 to-blue-600/80",
    activeGlow: "shadow-blue-500/20",
    activeLine: "bg-blue-300",
  },
  {
    id: "tactics",
    icon: Shield,
    title: "Tactics",
    gradient: "from-red-500/80 to-red-600/80",
    activeGlow: "shadow-red-500/20",
    activeLine: "bg-red-300",
  },
  {
    id: "transfers",
    icon: ArrowLeftRight,
    title: "Transfers",
    gradient: "from-cyan-500/80 to-cyan-600/80",
    activeGlow: "shadow-cyan-500/20",
    activeLine: "bg-cyan-300",
  },
  {
    id: "management",
    icon: Landmark,
    title: "Management",
    gradient: "from-amber-500/80 to-amber-600/80",
    activeGlow: "shadow-amber-500/20",
    activeLine: "bg-amber-300",
  },
];

interface MyLeagueSidebarNavProps {
  activeSection: MyLeagueSection;
  onNavigate: (section: MyLeagueSection) => void;
  variant?: "desktop" | "expanded" | "mobile";
  notifications?: Partial<Record<MyLeagueSection, number>>;
  teamColor?: string;
}

export function MyLeagueSidebarNav({
  activeSection,
  onNavigate,
  variant = "desktop",
  notifications,
  teamColor,
}: MyLeagueSidebarNavProps) {
  const activeId = activeSection;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child border-border bg-card/60 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const noteCount = notifications?.[item.id] ?? 0;
            const cls = cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 overflow-hidden",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-lg pl-3.5", !teamColor && item.gradient)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            );
            const dot = noteCount > 0 && !isActive && (
              <span className="ring-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2" />
            );

            const activeStyle =
              isActive && teamColor
                ? {
                    background: `linear-gradient(to right, ${teamColor}e6, ${teamColor}b3)`,
                    boxShadow: `0 4px 12px ${teamColor}33`,
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
                      !teamColor && item.activeLine
                    )}
                    style={teamColor ? { backgroundColor: teamColor } : undefined}
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
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          const noteCount = notifications?.[item.id] ?? 0;
          const cls = cn(
            "relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200 overflow-hidden",
            isActive
              ? cn(
                  "bg-gradient-to-r text-white shadow-lg pl-3.5",
                  !teamColor && item.gradient,
                  !teamColor && item.activeGlow
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
            isActive && teamColor
              ? {
                  background: `linear-gradient(to right, ${teamColor}e6, ${teamColor}b3)`,
                  boxShadow: `0 4px 12px ${teamColor}33`,
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
                    !teamColor && item.activeLine
                  )}
                  style={teamColor ? { backgroundColor: teamColor } : undefined}
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
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        const noteCount = notifications?.[item.id] ?? 0;

        const activeStyle =
          isActive && teamColor
            ? {
                background: `linear-gradient(to right, ${teamColor}e6, ${teamColor}b3)`,
                boxShadow: `0 4px 12px ${teamColor}33`,
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
                      !teamColor && item.gradient,
                      !teamColor && item.activeGlow
                    )
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={activeStyle}
            >
              {isActive && (
                <span
                  className={cn(
                    "absolute top-1 bottom-1 left-0 w-0.5 rounded-r-sm",
                    !teamColor && item.activeLine
                  )}
                  style={teamColor ? { backgroundColor: teamColor } : undefined}
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
