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
  Coins,
  Layers,
  Cpu,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Bookmark,
  FolderHeart,
  Award,
  Shield,
  Terminal,
  Trophy,
  Search,
  Newspaper,
  Palette,
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
  section: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "System Control",
    items: [
      {
        label: "General Settings",
        href: "/admin/settings",
        icon: Settings,
        description: "General system parameters & time",
        activeColor: "text-indigo-500 dark:text-indigo-400 border-l-indigo-500",
        section: "settings",
      },
      {
        label: "Bot Settings",
        href: "/admin/bot",
        icon: Cpu,
        description: "Bot controls, logs & schedules",
        activeColor: "text-emerald-500 dark:text-emerald-400 border-l-emerald-500",
        section: "bot",
      },
      {
        label: "Notification Settings",
        href: "/admin/notifications",
        icon: Bell,
        description: "Rules, logs & test alerts",
        activeColor: "text-rose-500 dark:text-rose-400 border-l-rose-500",
        section: "notifications",
      },
      {
        label: "Stash Settings",
        href: "/admin/stash",
        icon: FolderHeart,
        description: "Offline sync & default stashes",
        activeColor: "text-blue-500 dark:text-blue-400 border-l-blue-500",
        section: "stash",
      },
      {
        label: "ThinkPages Settings",
        href: "/admin/thinkpages",
        icon: Globe,
        description: "Social feeds & posting rules",
        activeColor: "text-sky-500 dark:text-sky-400 border-l-sky-500",
        section: "thinkpages",
      },
      {
        label: "Blurbs",
        href: "/admin/blurbs",
        icon: MessageCircle,
        description: "Topic prompts & moderation",
        activeColor: "text-violet-500 dark:text-violet-400 border-l-violet-500",
        section: "blurbs",
      },
    ],
  },
  {
    title: "World Config",
    items: [
      {
        label: "Settings",
        href: "/admin/world-settings",
        icon: Settings,
        description: "Active gameworld settings",
        activeColor: "text-cyan-500 dark:text-cyan-400 border-l-cyan-500",
        section: "world-settings",
      },
      {
        label: "Storyteller™",
        href: "/admin/storyteller",
        icon: Gamepad2,
        description: "Events & live interventions",
        activeColor: "text-purple-500 dark:text-purple-400 border-l-purple-500",
        section: "storyteller",
      },
      {
        label: "National Issues",
        href: "/admin/national-issues",
        icon: Newspaper,
        description: "Issue templates & DM injection",
        activeColor: "text-rose-500 dark:text-rose-400 border-l-rose-500",
        section: "national-issues",
      },
      {
        label: "Realms™",
        href: "/admin/realms",
        icon: Sparkles,
        description: "Realm list & user assignments",
        activeColor: "text-pink-500 dark:text-pink-400 border-l-pink-500",
        section: "realms",
      },
      {
        label: "WorldStudio™",
        href: "/admin/worldstudio",
        icon: Map,
        description: "World map editor & assignments",
        activeColor: "text-teal-500 dark:text-teal-400 border-l-teal-500",
        section: "worldstudio",
      },
      {
        label: "Map Style Editor",
        href: "/admin/maps/style-editor",
        icon: Palette,
        description: "Visual map theme styles",
        activeColor: "text-blue-500 dark:text-blue-400 border-l-blue-500",
        section: "style-editor",
      },
      {
        label: "Card Settings",
        href: "/admin/cards",
        icon: Package,
        description: "Sync, packs, lore & seasons",
        activeColor: "text-orange-500 dark:text-orange-400 border-l-orange-500",
        section: "cards",
      },
      {
        label: "Vault Settings",
        href: "/admin/vault",
        icon: Coins,
        description: "Balances, streaks & store",
        activeColor: "text-amber-500 dark:text-amber-400 border-l-amber-500",
        section: "vault",
      },
      {
        label: "Achievements & Awards",
        href: "/admin/achievements",
        icon: Award,
        description: "Custom awards & system points",
        activeColor: "text-yellow-500 dark:text-yellow-400 border-l-yellow-500",
        section: "achievements",
      },
      {
        label: "Reference Data",
        href: "/admin/reference-data",
        icon: Database,
        description: "Manage database data types",
        activeColor: "text-cyan-500 dark:text-cyan-400 border-l-cyan-500",
        section: "reference-data",
      },
    ],
  },
  {
    title: "Users",
    items: [
      {
        label: "User Management",
        href: "/admin/user-management",
        icon: Users,
        description: "User list & country binders",
        activeColor: "text-amber-500 dark:text-amber-400 border-l-amber-500",
        section: "user-management",
      },
      {
        label: "User Roles",
        href: "/admin/user-roles",
        icon: Shield,
        description: "Role assignments & permissions",
        activeColor: "text-amber-500 dark:text-amber-400 border-l-amber-500",
        section: "user-roles",
      },
      {
        label: "User Logs",
        href: "/admin/user-logs",
        icon: Terminal,
        description: "Database queries & audit logs",
        activeColor: "text-indigo-500 dark:text-indigo-400 border-l-indigo-500",
        section: "user-logs",
      },
    ],
  },
  {
    title: "WikiOS",
    items: [
      {
        label: "Settings",
        href: "/admin/wikios-settings",
        icon: BookOpen,
        description: "Base link configurations",
        activeColor: "text-sky-500 dark:text-sky-400 border-l-sky-500",
        section: "wikios-settings",
      },
      {
        label: "LoreScanner",
        href: "/admin/lorescanner",
        icon: Search,
        description: "Automatic wiki links scanner",
        activeColor: "text-blue-500 dark:text-blue-400 border-l-blue-500",
        section: "lorescanner",
      },
      {
        label: "Image Repository",
        href: "/admin/image-repo",
        icon: Layers,
        description: "WikiOS Commons image explorer",
        activeColor: "text-teal-500 dark:text-teal-400 border-l-teal-500",
        section: "image-repo",
      },
    ],
  },
  {
    title: "Labs",
    items: [
      {
        label: "MyLeague Settings",
        href: "/admin/myleague",
        icon: Trophy,
        description: "Simulation sandbox & pipeline viz",
        activeColor: "text-amber-500 dark:text-amber-400 border-l-amber-500",
        section: "myleague",
      },
    ],
  },
];

const UNGROUPED_ITEMS: NavItem[] = [
  {
    label: "Facet Materials Lab",
    href: "/admin/facet-lab",
    icon: Layers,
    description: "Material configurator & configurations",
    activeColor: "text-teal-500 dark:text-teal-400 border-l-teal-500",
    section: "facet-lab",
  },
  {
    label: "Polls",
    href: "/admin/polls",
    icon: Vote,
    description: "Create & manage polls",
    activeColor: "text-purple-500 dark:text-purple-400 border-l-purple-500",
    section: "polls",
  },
];

function getSectionFromPathname(rawPathname: string): string {
  const pathname = rawPathname.replace(/\/$/, "");
  if (pathname === "/admin") return "dashboard";

  // Find in groups
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (
        pathname === withBasePath(item.href) ||
        pathname.startsWith(withBasePath(item.href) + "/")
      ) {
        return item.section;
      }
    }
  }

  // Find in ungrouped
  for (const item of UNGROUPED_ITEMS) {
    if (
      pathname === withBasePath(item.href) ||
      pathname.startsWith(withBasePath(item.href) + "/")
    ) {
      return item.section;
    }
  }

  return "dashboard";
}

function isActive(
  pathname: string,
  href: string,
  exact?: boolean,
  activeSection?: string,
  sectionId?: string
): boolean {
  if (activeSection && sectionId) {
    return activeSection === sectionId;
  }
  const normalizedPath = pathname.replace(/\/$/, "") || "/admin";
  const normalizedHref = href.replace(/\/$/, "");
  if (exact) return normalizedPath === normalizedHref;
  return normalizedPath === normalizedHref || normalizedPath.startsWith(normalizedHref + "/");
}

interface AdminSidebarNavWidgetProps {
  onNavigate?: (section: string) => void;
  activeSection?: string;
}

export function AdminSidebarNavWidget({ onNavigate, activeSection }: AdminSidebarNavWidgetProps) {
  const pathname = usePathname();
  const currentSection = activeSection ?? getSectionFromPathname(pathname);
  const isControlled = !!onNavigate;

  const renderItem = (item: NavItem) => {
    const active = isActive(
      pathname,
      withBasePath(item.href),
      item.exact,
      currentSection,
      item.section
    );

    const handleClick = (e: React.MouseEvent) => {
      if (item.section === "style-editor") {
        return;
      }
      // Middle click, Cmd+click, Ctrl+click, Shift+click should behave normally (open in new tab/window)
      if (isControlled && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        onNavigate(item.section);
      }
    };

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2.5 rounded-lg border-l-2 border-l-transparent px-2.5 py-2 text-left transition-all duration-200",
          active
            ? cn("bg-muted/60 border-l-2 shadow-inner backdrop-blur-sm", item.activeColor)
            : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
        )}
      >
        <item.icon className="h-4.5 w-4.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] leading-tight font-semibold tracking-wide whitespace-nowrap">
            {item.label}
          </div>
          {item.description && !active && (
            <div className="text-muted-foreground/60 truncate text-[9px]">{item.description}</div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <nav className="border-border/30 bg-card/40 flex max-h-[calc(100vh-320px)] w-full flex-col rounded-xl border p-2 shadow-sm backdrop-blur-md">
      <div className="thin-scrollbar mt-2 flex-1 [scrollbar-width:thin] space-y-2.5 overflow-y-auto pr-1">
        {/* Render grouped links */}
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="text-muted-foreground/50 px-2.5 text-[8px] font-bold tracking-wider uppercase select-none">
              {group.title}
            </div>
            <div className="space-y-0.5 pl-0.5">{group.items.map(renderItem)}</div>
          </div>
        ))}

        {/* Render ungrouped items */}
        <div className="space-y-1 border-t border-white/5 pt-2">
          <div className="space-y-0.5">{UNGROUPED_ITEMS.map(renderItem)}</div>
        </div>
      </div>
    </nav>
  );
}
