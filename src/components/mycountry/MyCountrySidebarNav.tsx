"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Shield, Crown, Users, Map, LayoutDashboard } from "lucide-react";
import { cn } from "~/lib/utils";

export type MyCountrySection = "overview" | "executive" | "diplomacy" | "intelligence" | "defense" | "map-editor";

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
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
  },
  {
    id: "executive",
    href: "/mycountry/executive",
    icon: Crown,
    title: "Executive",
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
  },
  {
    id: "diplomacy",
    href: "/mycountry/diplomacy",
    icon: Users,
    title: "Diplomacy",
    gradient: "from-purple-500 to-pink-500",
    activeGlow: "shadow-purple-500/30",
  },
  {
    id: "intelligence",
    href: "/mycountry/intelligence",
    icon: Brain,
    title: "Intelligence",
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
  },
  {
    id: "defense",
    href: "/mycountry/defense",
    icon: Shield,
    title: "Defense",
    gradient: "from-red-500 to-orange-500",
    activeGlow: "shadow-red-500/30",
  },
  {
    id: "map-editor",
    href: "/mycountry/map-editor",
    icon: Map,
    title: "Map Editor",
    gradient: "from-emerald-500 to-teal-500",
    activeGlow: "shadow-emerald-500/30",
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
}

export function MyCountrySidebarNav({ activeSection, onNavigate, variant = "desktop" }: MyCountrySidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md dark:bg-black/10">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const Icon = item.icon;
            const cls = cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient)
                : "text-muted-foreground hover:bg-white/10 hover:text-foreground dark:hover:bg-white/5",
            );

            return isControlled ? (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={cls} aria-current={isActive ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            ) : (
              <Link key={item.id} href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.title}</span>
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
      <nav className="flex w-full flex-col gap-1 rounded-xl border border-white/10 bg-white/60 p-1.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          const cls = cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200",
            isActive
              ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
              : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
          );

          return isControlled ? (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={cls} aria-current={isActive ? "page" : undefined}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </button>
          ) : (
            <Link key={item.id} href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  /* ── Desktop: icon rail with tooltip labels ── */
  return (
    <nav className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/60 p-1.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;

        const iconEl = (
          <div
            className={cn(
              "group/tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-br text-white shadow-md", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px] transition-transform duration-150", !isActive && "group-hover/tip:scale-110")} />

            {/* Tooltip — appears to the right */}
            <span
              className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 dark:bg-gray-100 dark:text-gray-900"
            >
              {item.title}
              {/* Arrow */}
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-100" />
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
