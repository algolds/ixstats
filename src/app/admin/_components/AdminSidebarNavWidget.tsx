"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Gamepad2,
  Globe,
  Map,
  Users,
  Database,
  BookOpen,
  Sparkles,
  MessageCircle,
  Bell,
  Package,
  Vote,
} from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  description?: string;
  activeColor: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
    activeColor: "text-blue-500 dark:text-blue-400 border-l-blue-500",
  },
  {
    label: "Platform",
    href: "/admin/platform",
    icon: Settings,
    description: "Time, Economy, Bot & System",
    activeColor: "text-indigo-500 dark:text-indigo-400 border-l-indigo-500",
  },
  {
    label: "Storyteller™",
    href: "/admin/storyteller",
    icon: Gamepad2,
    description: "World Events & Simulation",
    activeColor: "text-purple-500 dark:text-purple-400 border-l-purple-500",
  },
  {
    label: "Countries",
    href: "/admin/countries",
    icon: Globe,
    description: "Live Grid & Analytics",
    activeColor: "text-emerald-500 dark:text-emerald-400 border-l-emerald-500",
  },
  {
    label: "Maps",
    href: "/admin/maps",
    icon: Map,
    description: "World Map & Assignments",
    activeColor: "text-teal-500 dark:text-teal-400 border-l-teal-500",
  },
  {
    label: "World Studio",
    href: "/admin/studio",
    icon: Sparkles,
    description: "Realms & World Configs",
    activeColor: "text-pink-500 dark:text-pink-400 border-l-pink-500",
  },
  {
    label: "Users & Roles",
    href: "/admin/users",
    icon: Users,
    description: "Management & Permissions",
    activeColor: "text-amber-500 dark:text-amber-400 border-l-amber-500",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    description: "Events, Logs & Alert Rules",
    activeColor: "text-rose-500 dark:text-rose-400 border-l-rose-500",
  },
  {
    label: "Card Management",
    href: "/admin/cards",
    icon: Package,
    description: "Sync, Packs, Lore & Vaults",
    activeColor: "text-orange-500 dark:text-orange-400 border-l-orange-500",
  },
  {
    label: "Reference Data",
    href: "/admin/reference-data",
    icon: Database,
    description: "Unified Data Manager",
    activeColor: "text-cyan-500 dark:text-cyan-400 border-l-cyan-500",
  },
  {
    label: "Wiki Management",
    href: "/admin/wiki",
    icon: BookOpen,
    description: "Wiki Links & Scanning",
    activeColor: "text-sky-500 dark:text-sky-400 border-l-sky-500",
  },
  {
    label: "Blurbs",
    href: "/admin/blurbs",
    icon: MessageCircle,
    description: "Topic Prompts & Responses",
    activeColor: "text-violet-500 dark:text-violet-400 border-l-violet-500",
  },
  {
    label: "Polls",
    href: "/admin/polls",
    icon: Vote,
    description: "Create & Manage Feed Polls",
    activeColor: "text-purple-500 dark:text-purple-400 border-l-purple-500",
  },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  const normalizedPath = pathname.replace(/\/$/, "") || "/admin";
  const normalizedHref = href.replace(/\/$/, "");
  if (exact) return normalizedPath === normalizedHref;
  return normalizedPath === normalizedHref || normalizedPath.startsWith(normalizedHref + "/");
}

interface AdminSidebarNavWidgetProps {
  onNavigate?: () => void;
}

export function AdminSidebarNavWidget({ onNavigate }: AdminSidebarNavWidgetProps) {
  const pathname = usePathname();

  return (
    <nav className="border-border/30 bg-card/40 w-full space-y-1 rounded-xl border p-2 shadow-sm backdrop-blur-md">
      <div className="text-muted-foreground/80 px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase">
        Navigation
      </div>
      <div className="space-y-1 pr-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, withBasePath(item.href), item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border-l-2 border-l-transparent px-2.5 py-2 text-left transition-all duration-200",
                active
                  ? cn("bg-muted/60 border-l-2 shadow-inner backdrop-blur-sm", item.activeColor)
                  : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] leading-tight font-semibold tracking-wide">
                  {item.label}
                </div>
                {item.description && !active && (
                  <div className="text-muted-foreground/60 truncate text-[9px]">
                    {item.description}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
