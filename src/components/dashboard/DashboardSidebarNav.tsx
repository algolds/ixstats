"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Globe, Newspaper } from "lucide-react";
import { cn } from "~/lib/utils";
import { LayoutDashboardIcon, GlobeAltIcon } from "~/components/ui/icons";
import { stripBasePath } from "~/lib/base-path";

export type DashboardSection = "activity" | "feed" | "world";

/** Map section ids to their animated icon counterparts */
const ANIMATED_NAV_ICONS: Partial<Record<DashboardSection, React.ComponentType<{ size?: number; className?: string }>>> = {
  activity: LayoutDashboardIcon,
  world: GlobeAltIcon,
};

/** Renders the animated icon for a section when available, falling back to the lucide icon */
function NavIcon({ id, fallback: Fallback, className, size = 16 }: { id: DashboardSection; fallback: LucideIcon; className?: string; size?: number }) {
  const Animated = ANIMATED_NAV_ICONS[id];
  if (Animated) return <Animated size={size} className={className} />;
  return <Fallback className={cn("h-4 w-4", className)} />;
}

export const DASHBOARD_NAV_ITEMS: {
  id: DashboardSection;
  href: string;
  icon: typeof LayoutDashboard;
  title: string;
  gradient: string;
  activeGlow: string;
}[] = [
  {
    id: "activity",
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Command Overview",
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
  },
  {
    id: "feed",
    href: "/dashboard/feed",
    icon: Newspaper,
    title: "Feed",
    gradient: "from-purple-500 to-violet-500",
    activeGlow: "shadow-purple-500/30",
  },
  {
    id: "world",
    href: "/dashboard/world",
    icon: Globe,
    title: "World",
    gradient: "from-emerald-500 to-green-500",
    activeGlow: "shadow-emerald-500/30",
  },
];

export function getSectionFromPathname(rawPathname: string): DashboardSection {
  const pathname = stripBasePath(rawPathname);
  if (pathname.startsWith("/dashboard/feed")) return "feed";
  if (pathname.startsWith("/dashboard/world") || pathname.startsWith("/dashboard/diplomacy") || pathname.startsWith("/dashboard/trends")) return "world";
  return "activity";
}

interface DashboardSidebarNavProps {
  activeSection?: DashboardSection;
  onNavigate?: (section: DashboardSection) => void;
  variant?: "desktop" | "mobile";
}

export function DashboardSidebarNav({ activeSection, onNavigate, variant = "desktop" }: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child overflow-hidden rounded-xl border border-border/50 bg-muted/30 p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const cls = cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            );

            return isControlled ? (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={cls} aria-current={isActive ? "page" : undefined}>
                <NavIcon id={item.id} fallback={item.icon} size={14} className="flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            ) : (
              <Link key={item.id} href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
                <NavIcon id={item.id} fallback={item.icon} size={14} className="flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Desktop: expanded sidebar with icon + label ── */
  return (
    <nav className="flex w-56 flex-col gap-1 rounded-xl border border-border/50 bg-background/80 p-1.5 shadow-sm backdrop-blur-lg">
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;

        const rowEl = (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <NavIcon id={item.id} fallback={item.icon} size={16} className="flex-shrink-0" />
            <span className="truncate text-xs font-medium">{item.title}</span>
          </div>
        );

        return isControlled ? (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
            aria-current={isActive ? "page" : undefined}
          >
            {rowEl}
          </button>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
            aria-current={isActive ? "page" : undefined}
          >
            {rowEl}
          </Link>
        );
      })}
    </nav>
  );
}
