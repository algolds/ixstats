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
import { cn } from "~/lib/utils/cn";
import { SearchField } from "~/components/ui/search-field";
import { buttonVariants } from "~/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  description?: string;
  glyphClass: string;
  section: string;
}

interface NavSubgroup {
  subtitle: string;
  items: NavItem[];
}

interface NavGroup {
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
            label: "General settings",
            href: "/admin/platform",
            icon: Settings,
            description: "Time, growth multipliers, and database explorer",
            glyphClass: "bg-indigo/15 text-indigo",
            section: "platform",
          },
          {
            label: "Bot settings",
            href: "/admin/bot",
            icon: Cpu,
            description: "Scheduled worker tasks, Discord bot sync, and status",
            glyphClass: "bg-green/15 text-green",
            section: "bot",
          },
          {
            label: "Notification settings",
            href: "/admin/notifications",
            icon: Bell,
            description: "Alert rules and system dispatch logs",
            glyphClass: "bg-red/15 text-red",
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
            label: "Realms settings",
            href: "/admin/realms",
            icon: Sparkles,
            description: "Community regions, custom worlds, and player access",
            glyphClass: "bg-pink/15 text-pink",
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
            href: "/admin/maps",
            icon: Map,
            description: "Map editor and GIS vector layers",
            glyphClass: "bg-teal/15 text-teal",
            section: "maps",
          },
          {
            label: "Map style editor",
            href: "/admin/maps/style-editor",
            icon: Palette,
            description: "Map color palettes and layer styles",
            glyphClass: "bg-blue/15 text-blue",
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
            glyphClass: "bg-blue/15 text-blue",
            section: "wikios-settings",
          },
          {
            label: "LoreScanner",
            href: "/admin/lorescanner",
            icon: Search,
            description: "Automatic article backlink scanner",
            glyphClass: "bg-blue/15 text-blue",
            section: "lorescanner",
          },
          {
            label: "Image repository",
            href: "/admin/image-repo",
            icon: Layers,
            description: "Media repository and upload manager",
            glyphClass: "bg-teal/15 text-teal",
            section: "image-repo",
          },
          {
            label: "Stash settings",
            href: "/admin/stash",
            icon: FolderHeart,
            description: "Offline article cache and user storage quotas",
            glyphClass: "bg-indigo/15 text-indigo",
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
            glyphClass: "bg-yellow/15 text-yellow",
            section: "vault",
          },
          {
            label: "Card packs & lore",
            href: "/admin/cards",
            icon: Package,
            description: "Packs, season rotations, and lore card sync",
            glyphClass: "bg-orange/15 text-orange",
            section: "cards",
          },
          {
            label: "Achievements & awards",
            href: "/admin/achievements",
            icon: Award,
            description: "Badges, point tiers, and unlock rules",
            glyphClass: "bg-yellow/15 text-yellow",
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
            glyphClass: "bg-purple/15 text-purple",
            section: "thinkpages",
          },
          {
            label: "Blurbs & prompts",
            href: "/admin/blurbs",
            icon: MessageCircle,
            description: "Writing prompts and flagged post moderation",
            glyphClass: "bg-purple/15 text-purple",
            section: "blurbs",
          },
          {
            label: "Polls management",
            href: "/admin/polls",
            icon: Vote,
            description: "Poll creation, duration, and vote counts",
            glyphClass: "bg-pink/15 text-pink",
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
            glyphClass: "bg-green/15 text-green",
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
            glyphClass: "bg-green/15 text-green",
            section: "countries",
          },
          {
            label: "Calculations editor",
            href: "/admin/calculations",
            icon: Cpu,
            description: "Macroeconomic formula definitions",
            glyphClass: "bg-yellow/15 text-yellow",
            section: "calculations",
          },
          {
            label: "Vitality rings audit",
            href: "/admin/rings-audit",
            icon: Activity,
            description: "Vitality dimensions and index weight validation",
            glyphClass: "bg-green/15 text-green",
            section: "rings-audit",
          },
          {
            label: "Reference data catalog",
            href: "/admin/reference-data",
            icon: Database,
            description: "Simulation enums and lookup tables",
            glyphClass: "bg-teal/15 text-teal",
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
            glyphClass: "bg-purple/15 text-purple",
            section: "storyteller",
          },
          {
            label: "National issues",
            href: "/admin/national-issues",
            icon: Newspaper,
            description: "Issue templates and multiple-choice dilemma options",
            glyphClass: "bg-red/15 text-red",
            section: "national-issues",
          },
          {
            label: "Diplomatic options",
            href: "/admin/diplomatic-options",
            icon: Bookmark,
            description: "Diplomatic stances, priorities, and pacts",
            glyphClass: "bg-blue/15 text-blue",
            section: "diplomatic-options",
          },
          {
            label: "Diplomatic scenarios",
            href: "/admin/diplomatic-scenarios",
            icon: Shield,
            description: "Scenario outcomes and conflict chains",
            glyphClass: "bg-purple/15 text-purple",
            section: "diplomatic-scenarios",
          },
          {
            label: "NPC Personalities",
            href: "/admin/npc-personalities",
            icon: Users,
            description: "NPC leader archetypes and reaction thresholds",
            glyphClass: "bg-purple/15 text-purple",
            section: "npc-personalities",
          },
        ],
      },
      {
        subtitle: "Statecraft Engine",
        items: [
          {
            label: "Military equipment",
            href: "/admin/military-equipment",
            icon: Package,
            description: "Unit stats, defense systems, and unit costs",
            glyphClass: "bg-red/15 text-red",
            section: "military-equipment",
          },
          {
            label: "Economic archetypes",
            href: "/admin/economic-archetypes",
            icon: Trophy,
            description: "Macroeconomic policy templates",
            glyphClass: "bg-yellow/15 text-yellow",
            section: "economic-archetypes",
          },
          {
            label: "Economic components",
            href: "/admin/economic-components",
            icon: Layers,
            description: "Economic building blocks and modifiers",
            glyphClass: "bg-yellow/15 text-yellow",
            section: "economic-components",
          },
          {
            label: "Government components",
            href: "/admin/government-components",
            icon: Database,
            description: "Civic institutions and governance modules",
            glyphClass: "bg-teal/15 text-teal",
            section: "government-components",
          },
          {
            label: "Intelligence templates",
            href: "/admin/intelligence-templates",
            icon: Shield,
            description: "Intel report structures and schemas",
            glyphClass: "bg-blue/15 text-blue",
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
            label: "User management",
            href: "/admin/users",
            icon: Users,
            description: "Account roster and nation claims",
            glyphClass: "bg-yellow/15 text-yellow",
            section: "users",
          },
          {
            label: "User Roles & VIPs",
            href: "/admin/user-roles",
            icon: Shield,
            description: "Role permissions and VIP keys",
            glyphClass: "bg-teal/15 text-teal",
            section: "user-roles",
          },
          {
            label: "User logs",
            href: "/admin/logs",
            icon: Terminal,
            description: "Audit trail and admin action logs",
            glyphClass: "bg-indigo/15 text-indigo",
            section: "logs",
          },
          {
            label: "Membership tiers",
            href: "/admin/membership",
            icon: Award,
            description: "Subscription levels and access perks",
            glyphClass: "bg-yellow/15 text-yellow",
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
            glyphClass: "bg-yellow/15 text-yellow",
            section: "narrator",
          },
          {
            label: "Onoma linguistics",
            href: "/admin/onoma",
            icon: Languages,
            description: "Phonetic rules and name generation",
            glyphClass: "bg-indigo/15 text-indigo",
            section: "onoma",
          },
          {
            label: "Facet materials lab",
            href: "/admin/facet-lab",
            icon: Layers,
            description: "Facet glass materials and token inspector",
            glyphClass: "bg-teal/15 text-teal",
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

  if (pathname.includes("/admin/platform")) return "platform";
  if (pathname.includes("/admin/autosave-monitor")) return "autosave-monitor";

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
  /** Marks the rail as app-local sub-navigation (hidden under the new navigation shell). */
  "data-app-subnav"?: string;
}

export function AdminSidebarNavWidget({
  activeSection,
  onNavigate,
  className = "",
  "data-app-subnav": appSubnav,
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

  // Sidebar-style nav row: the `ghost` Button at the 36px control height (follows Compact
  // density), left-aligned, with tint selection for the current section.
  const rowClass = (active: boolean) =>
    cn(
      buttonVariants({ variant: "ghost", size: "default" }),
      "group text-callout flex w-full justify-start gap-2 px-2 text-left font-normal",
      active
        ? "bg-tint-fill text-tint hover:bg-tint/20 font-medium"
        : "text-label-secondary hover:text-label"
    );

  const rowBody = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <>
        <span
          aria-hidden
          className={cn(
            "rounded-control-sm flex size-6 shrink-0 items-center justify-center",
            item.glyphClass
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </>
    );
  };

  return (
    <aside
      data-app-subnav={appSubnav}
      className={cn(
        "flex w-full flex-col lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto",
        className
      )}
      aria-label="Admin navigation"
    >
      {/* Search filter */}
      <SearchField
        size="sm"
        placeholder="Filter tools & applications..."
        aria-label="Filter admin tools"
        value={searchQuery}
        onValueChange={setSearchQuery}
        containerClassName="mb-5"
      />

      <nav className="space-y-5">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-subhead text-label-secondary px-2">{group.title}</h3>

            {/* Inset-grouped rail surface (a thin glass group) */}
            <div className="material-thin border-separator space-y-2 rounded-2xl border p-1">
              {group.subgroups.map((sub, sIdx) => (
                <div
                  key={sub.subtitle}
                  className={sIdx > 0 ? "border-separator border-t pt-2" : ""}
                >
                  <div className="text-footnote text-label-secondary px-2 py-0.5">
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

                      if (onNavigate) {
                        return (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => onNavigate(item.section)}
                            aria-current={active ? "page" : undefined}
                            className={rowClass(active)}
                          >
                            {rowBody(item)}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={rowClass(active)}
                        >
                          {rowBody(item)}
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
