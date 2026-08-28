"use client";
// src/app/admin/_components/AdminSidebarNavWidget.tsx
// Apple Settings Inspired Hierarchical Inset-Grouped Navigation

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import {
  Activity,
  Medal as Award,
  Bell,
  OpenBook as BookOpen,
  Bookmark,
  CheckSquare as Vote,
  Coins,
  Cpu,
  Database,
  Folder as FolderHeart,
  Gamepad as Gamepad2,
  Globe,
  Group as Users,
  Journal as Newspaper,
  Component as Layers,
  ViewGrid as LayoutDashboard,
  Map,
  ChatBubble as MessageCircle,
  Package,
  Palette,
  Search,
  Settings,
  Shield,
  Sparks as Sparkles,
  Terminal,
  Translate as Languages,
  Trophy,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  description?: string;
  glyphClass: string;
  section: string;
}

export interface NavSubgroup {
  subtitle: string;
  items: NavItem[];
}

export interface NavGroup {
  title: string;
  icon?: typeof LayoutDashboard;
  subgroups: NavSubgroup[];
}

const NAV_GROUPS: NavGroup[] = [
  // ── 1. System & Platform ──────────────────────────────────────────────────
  {
    title: "System & Platform",
    subgroups: [
      {
        subtitle: "Core",
        items: [
          {
            label: "General Settings",
            href: "/admin/platform",
            icon: Settings,
            description: "Time, growth multipliers, and database explorer",
            glyphClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
            section: "platform",
          },
          {
            label: "Bot Settings",
            href: "/admin/bot",
            icon: Cpu,
            description: "Scheduled worker tasks, Discord bot sync, and status",
            glyphClass: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
            section: "bot",
          },
          {
            label: "Notification Settings",
            href: "/admin/notifications",
            icon: Bell,
            description: "Alert rules and system dispatch logs",
            glyphClass: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
            section: "notifications",
          },
        ],
      },
    ],
  },

  // ── 2. Realms ─────────────────────────────────────────────────────────────
  {
    title: "Realms",
    subgroups: [
      {
        subtitle: "Regions & Communities",
        items: [
          {
            label: "Realms Settings",
            href: "/admin/realms",
            icon: Sparkles,
            description: "Community regions, custom worlds, and player access",
            glyphClass: "bg-pink-500/15 text-pink-500 dark:text-pink-400",
            section: "realms",
          },
        ],
      },
    ],
  },

  // ── 3. Apps ───────────────────────────────────────────────────────────────
  {
    title: "Apps",
    subgroups: [
      {
        subtitle: "Atlas",
        items: [
          {
            label: "WorldStudio Generator",
            href: "/admin/worldstudio",
            icon: Map,
            description: "Map editor and GIS vector layers",
            glyphClass: "bg-teal-500/15 text-teal-500 dark:text-teal-400",
            section: "worldstudio",
          },
          {
            label: "Map Style Editor",
            href: "/admin/maps/style-editor",
            icon: Palette,
            description: "Map color palettes and layer styles",
            glyphClass: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
            section: "style-editor",
          },
        ],
      },
      {
        subtitle: "WikiOS",
        items: [
          {
            label: "WikiOS Settings",
            href: "/admin/wikios-settings",
            icon: BookOpen,
            description: "MediaWiki API bridge and link routing",
            glyphClass: "bg-sky-500/15 text-sky-500 dark:text-sky-400",
            section: "wikios-settings",
          },
          {
            label: "LoreScanner",
            href: "/admin/lorescanner",
            icon: Search,
            description: "Automatic article backlink scanner",
            glyphClass: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
            section: "lorescanner",
          },
          {
            label: "Image Repository",
            href: "/admin/image-repo",
            icon: Layers,
            description: "Media repository and upload manager",
            glyphClass: "bg-teal-500/15 text-teal-500 dark:text-teal-400",
            section: "image-repo",
          },
          {
            label: "Stash Settings",
            href: "/admin/stash",
            icon: FolderHeart,
            description: "Offline article cache and user storage quotas",
            glyphClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
            section: "stash",
          },
        ],
      },
      {
        subtitle: "IxVault",
        items: [
          {
            label: "Vault & IxCredits",
            href: "/admin/vault",
            icon: Coins,
            description: "Credit balances, streaks, and store inventory",
            glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
            section: "vault",
          },
          {
            label: "Card Packs & Lore",
            href: "/admin/cards",
            icon: Package,
            description: "Packs, season rotations, and lore card sync",
            glyphClass: "bg-orange-500/15 text-orange-500 dark:text-orange-400",
            section: "cards",
          },
          {
            label: "Achievements & Awards",
            href: "/admin/achievements",
            icon: Award,
            description: "Badges, point tiers, and unlock rules",
            glyphClass: "bg-yellow-500/15 text-yellow-500 dark:text-yellow-400",
            section: "achievements",
          },
        ],
      },
      {
        subtitle: "ThinkPages",
        items: [
          {
            label: "ThinkPages Social",
            href: "/admin/thinkpages",
            icon: Globe,
            description: "Post feeds, rate limits, and author rules",
            glyphClass: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
            section: "thinkpages",
          },
          {
            label: "Blurbs & Prompts",
            href: "/admin/blurbs",
            icon: MessageCircle,
            description: "Writing prompts and flagged post moderation",
            glyphClass: "bg-violet-500/15 text-violet-500 dark:text-violet-400",
            section: "blurbs",
          },
          {
            label: "Polls Management",
            href: "/admin/polls",
            icon: Vote,
            description: "Poll creation, duration, and vote counts",
            glyphClass: "bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400",
            section: "polls",
          },
        ],
      },
      {
        subtitle: "MyLeague",
        items: [
          {
            label: "MyLeague Sports",
            href: "/admin/myleague",
            icon: Trophy,
            description: "League fixtures, teams, and tournament schedules",
            glyphClass: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
            section: "myleague",
          },
        ],
      },
    ],
  },

  // ── 4. Simulation Engines ─────────────────────────────────────────────────
  {
    title: "Simulation Engines",
    subgroups: [
      {
        subtitle: "MyCountry Engine",
        items: [
          {
            label: "Countries (God-Mode)",
            href: "/admin/countries",
            icon: Globe,
            description: "Live nation stats and manual metric overrides",
            glyphClass: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
            section: "countries",
          },
          {
            label: "Calculations Editor",
            href: "/admin/calculations",
            icon: Cpu,
            description: "Macroeconomic formula definitions",
            glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
            section: "calculations",
          },
          {
            label: "Vitality Rings Audit",
            href: "/admin/rings-audit",
            icon: Activity,
            description: "Vitality dimensions and index weight validation",
            glyphClass: "bg-green-500/15 text-green-500 dark:text-green-400",
            section: "rings-audit",
          },
          {
            label: "Reference Data Catalog",
            href: "/admin/reference-data",
            icon: Database,
            description: "Simulation enums and lookup tables",
            glyphClass: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400",
            section: "reference-data",
          },
        ],
      },
      {
        subtitle: "Concord Engine",
        items: [
          {
            label: "Storyteller",
            href: "/admin/storyteller",
            icon: Gamepad2,
            description: "Global events, crises, and intervention triggers",
            glyphClass: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
            section: "storyteller",
          },
          {
            label: "National Issues",
            href: "/admin/national-issues",
            icon: Newspaper,
            description: "Issue templates and multiple-choice dilemma options",
            glyphClass: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
            section: "national-issues",
          },
          {
            label: "Diplomatic Options",
            href: "/admin/diplomatic-options",
            icon: Bookmark,
            description: "Diplomatic stances, priorities, and pacts",
            glyphClass: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
            section: "diplomatic-options",
          },
          {
            label: "Diplomatic Scenarios",
            href: "/admin/diplomatic-scenarios",
            icon: Shield,
            description: "Scenario outcomes and conflict chains",
            glyphClass: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
            section: "diplomatic-scenarios",
          },
          {
            label: "NPC Personalities",
            href: "/admin/npc-personalities",
            icon: Users,
            description: "NPC leader archetypes and reaction thresholds",
            glyphClass: "bg-violet-500/15 text-violet-500 dark:text-violet-400",
            section: "npc-personalities",
          },
        ],
      },
      {
        subtitle: "Statecraft Engine",
        items: [
          {
            label: "Military Equipment",
            href: "/admin/military-equipment",
            icon: Package,
            description: "Unit stats, defense systems, and unit costs",
            glyphClass: "bg-red-500/15 text-red-500 dark:text-red-400",
            section: "military-equipment",
          },
          {
            label: "Economic Archetypes",
            href: "/admin/economic-archetypes",
            icon: Trophy,
            description: "Macroeconomic policy templates",
            glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
            section: "economic-archetypes",
          },
          {
            label: "Economic Components",
            href: "/admin/economic-components",
            icon: Layers,
            description: "Economic building blocks and modifiers",
            glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
            section: "economic-components",
          },
          {
            label: "Government Components",
            href: "/admin/government-components",
            icon: Database,
            description: "Civic institutions and governance modules",
            glyphClass: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400",
            section: "government-components",
          },
          {
            label: "Intelligence Templates",
            href: "/admin/intelligence-templates",
            icon: Shield,
            description: "Intel report structures and schemas",
            glyphClass: "bg-sky-500/15 text-sky-500 dark:text-sky-400",
            section: "intelligence-templates",
          },
        ],
      },
    ],
  },

  // ── 5. Users & Security ───────────────────────────────────────────────────
  {
    title: "Users & Security",
    subgroups: [
      {
        subtitle: "Access & Roles",
        items: [
          {
            label: "User Management",
            href: "/admin/users",
            icon: Users,
            description: "Account roster and nation claims",
            glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
            section: "users",
          },
          {
            label: "User Roles & VIPs",
            href: "/admin/user-roles",
            icon: Shield,
            description: "Role permissions and VIP keys",
            glyphClass: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400",
            section: "user-roles",
          },
          {
            label: "User Logs",
            href: "/admin/user-logs",
            icon: Terminal,
            description: "Audit trail and admin action logs",
            glyphClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
            section: "user-logs",
          },
          {
            label: "Membership Tiers",
            href: "/admin/membership",
            icon: Award,
            description: "Subscription levels and access perks",
            glyphClass: "bg-yellow-500/15 text-yellow-500 dark:text-yellow-400",
            section: "membership",
          },
        ],
      },
    ],
  },

  // ── 6. Labs & Experimental ────────────────────────────────────────────────
  {
    title: "Labs & Experimental",
    subgroups: [
      {
        subtitle: "Labs",
        items: [
          {
            label: "AI Narrator",
            href: "/admin/narrator",
            icon: MessageCircle,
            description: "Voice models, prompt sandbox, and response cache",
            glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
            section: "narrator",
          },
          {
            label: "Onoma Linguistics",
            href: "/admin/onoma",
            icon: Languages,
            description: "Phonetic rules and name generation",
            glyphClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
            section: "onoma",
          },
          {
            label: "Facet Materials Lab",
            href: "/admin/facet-lab",
            icon: Layers,
            description: "Facet glass materials and token inspector",
            glyphClass: "bg-teal-500/15 text-teal-500 dark:text-teal-400",
            section: "facet-lab",
          },
        ],
      },
    ],
  },
];

function getSectionFromPathname(rawPathname: string): string {
  const pathname = rawPathname.replace(/\/$/, "");
  if (pathname === "/admin") return "dashboard";

  // Alias maps
  if (pathname.includes("/admin/settings")) return "platform";
  if (pathname.includes("/admin/platform")) return "platform";
  if (pathname.includes("/admin/autosave-monitor")) return "autosave-monitor";
  if (pathname.includes("/admin/user-management")) return "users";

  for (const group of NAV_GROUPS) {
    for (const sub of group.subgroups) {
      for (const item of sub.items) {
        if (
          pathname === withBasePath(item.href) ||
          pathname.startsWith(withBasePath(item.href) + "/")
        ) {
          return item.section;
        }
      }
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
  const basePathHref = withBasePath(href);
  if (exact) {
    return pathname === basePathHref;
  }
  return pathname === basePathHref || pathname.startsWith(basePathHref + "/");
}

interface AdminSidebarNavWidgetProps {
  activeSection?: string;
  onNavigate?: (section: string) => void;
  className?: string;
}

export function AdminSidebarNavWidget({
  activeSection,
  onNavigate,
  className = "",
}: AdminSidebarNavWidgetProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const currentSection = useMemo(() => {
    return activeSection || getSectionFromPathname(pathname);
  }, [activeSection, pathname]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return NAV_GROUPS;
    const q = searchQuery.toLowerCase();

    return NAV_GROUPS.map((group) => {
      const matchingSubgroups = group.subgroups
        .map((sub) => ({
          ...sub,
          items: sub.items.filter(
            (item) =>
              item.label.toLowerCase().includes(q) ||
              item.description?.toLowerCase().includes(q) ||
              sub.subtitle.toLowerCase().includes(q)
          ),
        }))
        .filter((sub) => sub.items.length > 0);

      return {
        ...group,
        subgroups: matchingSubgroups,
      };
    }).filter((group) => group.subgroups.length > 0);
  }, [searchQuery]);

  return (
    <aside
      className={`facet-sidebar w-full flex-col p-4 shadow-sm lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto ${className}`}
      aria-label="Admin Navigation"
    >
      {/* Search Filter */}
      <div className="relative mb-5">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
        <input
          type="text"
          placeholder="Filter tools & applications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-border/30 bg-background/50 placeholder:text-muted-foreground focus:border-border/60 text-foreground w-full rounded-xl border py-1.5 pr-3 pl-8 text-xs backdrop-blur-md focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5 text-xs"
          >
            Clear
          </button>
        )}
      </div>

      <nav className="space-y-5">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h3 className="text-muted-foreground/70 px-2 text-[10px] font-bold tracking-wider uppercase">
              {group.title}
            </h3>

            {/* Apple Inset-Grouped Surface */}
            <div className="border-border/30 bg-card/25 space-y-2.5 rounded-2xl border p-1 backdrop-blur-md">
              {group.subgroups.map((sub, sIdx) => (
                <div
                  key={sub.subtitle}
                  className={sIdx > 0 ? "border-border/15 border-t pt-2" : ""}
                >
                  <div className="text-muted-foreground/50 px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                    {sub.subtitle}
                  </div>

                  <div className="mt-0.5 space-y-0.5">
                    {sub.items.map((item) => {
                      const active = isActive(
                        pathname,
                        item.href,
                        item.exact,
                        currentSection,
                        item.section
                      );
                      const Icon = item.icon;

                      if (onNavigate) {
                        return (
                          <button
                            key={item.href}
                            onClick={() => onNavigate(item.section)}
                            className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-xs font-medium transition-all active:scale-[0.98] ${
                              active
                                ? "bg-foreground/[0.08] dark:bg-foreground/[0.12] text-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                            }`}
                          >
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] transition-transform ${item.glyphClass} ${
                                active ? "scale-105" : "group-hover:scale-105"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate">{item.label}</span>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`group flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ${
                            active
                              ? "bg-foreground/[0.08] dark:bg-foreground/[0.12] text-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                          }`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] transition-transform ${item.glyphClass} ${
                              active ? "scale-105" : "group-hover:scale-105"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default AdminSidebarNavWidget;
