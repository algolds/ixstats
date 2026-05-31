"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Globe } from "lucide-react";
import { cn } from "~/lib/utils";
import { LayoutDashboardIcon, GlobeAltIcon } from "~/components/ui/icons";
import { stripBasePath } from "~/lib/base-path";

export type DashboardSection = "overview" | "world";

const ANIMATED_NAV_ICONS: Partial<
  Record<DashboardSection, React.ComponentType<{ size?: number; className?: string }>>
> = {
  overview: LayoutDashboardIcon,
  world: GlobeAltIcon,
};

function NavIcon({
  id,
  fallback: Fallback,
  className,
  size = 16,
}: {
  id: DashboardSection;
  fallback: LucideIcon;
  className?: string;
  size?: number;
}) {
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
    id: "overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Overview",
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
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
  if (
    pathname.startsWith("/dashboard/world") ||
    pathname.startsWith("/dashboard/diplomacy") ||
    pathname.startsWith("/dashboard/trends")
  )
    return "world";
  // /dashboard, /dashboard/feed, and anything else → overview
  return "overview";
}

interface DashboardSidebarNavProps {
  activeSection?: DashboardSection;
  onNavigate?: (section: DashboardSection) => void;
  variant?: "desktop" | "mobile";
}

export function DashboardSidebarNav({
  activeSection,
  onNavigate,
  variant = "desktop",
}: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child border-border/50 bg-muted/30 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const cls = cn(
              "flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? "bg-white/[0.08] text-foreground border-b-2 border-blue-500 rounded-t-lg"
                : "rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-border/50 bg-background/80 flex w-56 flex-col gap-1 rounded-xl border p-1.5 shadow-sm backdrop-blur-lg">
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;

        const rowEl = (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-l-none rounded-r-lg px-2.5 py-2 transition-all duration-200",
              isActive
                ? "text-foreground border-l-2 border-blue-500 bg-white/[0.08]"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <NavIcon id={item.id} fallback={item.icon} size={16} className="shrink-0" />
            <span className="truncate text-xs font-medium">{item.title}</span>
          </div>
        );

        return isControlled ? (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-current={isActive ? "page" : undefined}
          >
            {rowEl}
          </button>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-current={isActive ? "page" : undefined}
          >
            {rowEl}
          </Link>
        );
      })}
    </nav>
  );
}
