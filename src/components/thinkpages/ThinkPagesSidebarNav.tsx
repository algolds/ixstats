"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, Send } from "lucide-react";
import { cn } from "~/lib/utils";
import { stripBasePath } from "~/lib/base-path";

export type ThinkPagesSection = "feed" | "thinktanks" | "messages";

export const THINKPAGES_NAV_ITEMS: {
  id: ThinkPagesSection;
  href: string;
  icon: typeof MessageSquare;
  title: string;
  gradient: string;
  activeGlow: string;
}[] = [
  {
    id: "feed",
    href: "/thinkpages",
    icon: MessageSquare,
    title: "ThinkPages Feed",
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
  },
  {
    id: "thinktanks",
    href: "/thinkpages/thinktanks",
    icon: Users,
    title: "ThinkTanks",
    gradient: "from-purple-500 to-pink-500",
    activeGlow: "shadow-purple-500/30",
  },
  {
    id: "messages",
    href: "/thinkpages/thinkshare",
    icon: Send,
    title: "ThinkShare",
    gradient: "from-emerald-500 to-teal-500",
    activeGlow: "shadow-emerald-500/30",
  },
];

export function getSectionFromPathname(rawPathname: string): ThinkPagesSection {
  const pathname = stripBasePath(rawPathname);
  if (pathname.startsWith("/thinkpages/thinktanks")) return "thinktanks";
  if (pathname.startsWith("/thinkpages/thinkshare")) return "messages";
  return "feed";
}

interface ThinkPagesSidebarNavProps {
  activeSection?: ThinkPagesSection;
  onNavigate?: (section: ThinkPagesSection) => void;
  variant?: "desktop" | "mobile";
}

export function ThinkPagesSidebarNav({ activeSection, onNavigate, variant = "desktop" }: ThinkPagesSidebarNavProps) {
  const pathname = usePathname();
  const activeId = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav className="glass-hierarchy-child overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md dark:bg-black/10">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {THINKPAGES_NAV_ITEMS.map((item) => {
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

  /* ── Desktop: expanded sidebar with icon + label ── */
  return (
    <nav className="flex w-56 flex-col gap-1 rounded-xl border border-white/10 bg-white/60 p-1.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
      {THINKPAGES_NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;

        const rowEl = (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-200",
              isActive
                ? cn("bg-gradient-to-r text-white shadow-md", item.gradient, item.activeGlow)
                : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
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
