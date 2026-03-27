// src/app/admin/reference-data/page.tsx
// Unified reference data hub with grouped categories and live record counts
"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  Database,
  Flag,
  Drama,
  Rocket,
  UserCog,
  Newspaper,
  Building,
  TrendingUp,
  CreditCard,
  BookOpen,
  Layers,
  FileText,
  Swords,
  Brain,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Data Type Registry ───────────────────────────────────────────────────────

interface DataTypeConfig {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  category: "diplomacy" | "military" | "governance" | "economy" | "content" | "system";
  color: string;
}

const DATA_TYPES: DataTypeConfig[] = [
  // Diplomacy
  {
    key: "diplomatic-options",
    label: "Diplomatic Options",
    href: "/admin/diplomatic-options",
    icon: Flag,
    description: "Strategic priorities, partnership goals, key achievements",
    category: "diplomacy",
    color: "cyan",
  },
  {
    key: "diplomatic-scenarios",
    label: "Diplomatic Scenarios",
    href: "/admin/diplomatic-scenarios",
    icon: Drama,
    description: "Event templates with response options and outcomes",
    category: "diplomacy",
    color: "cyan",
  },

  // Military & Defense
  {
    key: "military-equipment",
    label: "Military Equipment",
    href: "/admin/military-equipment",
    icon: Rocket,
    description: "Equipment catalog, manufacturers, specifications",
    category: "military",
    color: "red",
  },

  // Governance & Politics
  {
    key: "government-components",
    label: "Government Components",
    href: "/admin/government-components",
    icon: Building,
    description: "9 categories of governance system components",
    category: "governance",
    color: "purple",
  },
  {
    key: "npc-personalities",
    label: "NPC Personalities",
    href: "/admin/npc-personalities",
    icon: UserCog,
    description: "8 personality traits, 6 archetypes, behavioral AI",
    category: "governance",
    color: "purple",
  },
  {
    key: "national-issues",
    label: "National Issues",
    href: "/admin/national-issues",
    icon: Newspaper,
    description: "Issue templates across 7 domains with consequences",
    category: "governance",
    color: "purple",
  },

  // Economy
  {
    key: "economic-components",
    label: "Economic Components",
    href: "/admin/economic-components",
    icon: TrendingUp,
    description: "5 categories of economic system components",
    category: "economy",
    color: "green",
  },
  {
    key: "economic-archetypes",
    label: "Economic Archetypes",
    href: "/admin/economic-archetypes",
    icon: Layers,
    description: "Archetype definitions with traits and modifiers",
    category: "economy",
    color: "green",
  },

  // Content & Intelligence
  {
    key: "intelligence-templates",
    label: "Intelligence Templates",
    href: "/admin/intelligence-templates",
    icon: FileText,
    description: "Briefing templates for economic, political, security reports",
    category: "content",
    color: "amber",
  },
  {
    key: "card-packs",
    label: "Card Packs",
    href: "/admin/card-packs",
    icon: CreditCard,
    description: "Pack configurations and rarity distributions",
    category: "content",
    color: "amber",
  },
  {
    key: "lore-cards",
    label: "Lore Cards",
    href: "/admin/lore-cards/batch-generator",
    icon: BookOpen,
    description: "Wiki-based lore card generation and management",
    category: "content",
    color: "amber",
  },

  // System
  {
    key: "ns-sync",
    label: "NS Sync",
    href: "/admin/ns-sync",
    icon: RefreshCw,
    description: "NationStates data synchronization and imports",
    category: "system",
    color: "blue",
  },
];

const CATEGORIES = [
  {
    key: "diplomacy" as const,
    label: "Diplomacy & Relations",
    icon: Swords,
    color: "cyan",
  },
  {
    key: "military" as const,
    label: "Military & Defense",
    icon: Rocket,
    color: "red",
  },
  {
    key: "governance" as const,
    label: "Governance & Politics",
    icon: Building,
    color: "purple",
  },
  {
    key: "economy" as const,
    label: "Economy & Trade",
    icon: TrendingUp,
    color: "green",
  },
  {
    key: "content" as const,
    label: "Content & Intelligence",
    icon: Brain,
    color: "amber",
  },
  {
    key: "system" as const,
    label: "System & Sync",
    icon: Database,
    color: "blue",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function ReferenceDataPage() {
  usePageTitle({ title: "Admin - Reference Data" });

  // Fetch counts from available endpoints
  const govComponents = api.governmentComponents.getAllComponents.useQuery(
    {},
    { refetchOnWindowFocus: false }
  );
  const econComponents = api.economicComponents.getAllComponents.useQuery(
    {},
    { refetchOnWindowFocus: false }
  );
  const npcData = api.npcPersonalities.getAllPersonalities.useQuery(
    {},
    { refetchOnWindowFocus: false }
  );
  const scenarios = api.diplomaticScenarios.getAllScenarios.useQuery(
    { limit: 1 },
    { refetchOnWindowFocus: false }
  );
  const archetypes = api.economicArchetypes.getAllArchetypes.useQuery(
    { limit: 1 },
    { refetchOnWindowFocus: false }
  );

  // Build count map from available data
  const counts: Record<string, number | undefined> = {
    "government-components": govComponents.data?.count,
    "economic-components": econComponents.data?.count,
    "npc-personalities": Array.isArray(npcData.data) ? npcData.data.length : undefined,
    "diplomatic-scenarios": scenarios.data?.total,
    "economic-archetypes": archetypes.data?.pagination?.total,
  };

  const totalRecords = Object.values(counts).reduce(
    (sum, c) => (c != null ? sum + c : sum),
    0
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Database}
        title="Reference Data"
        description="Manage all platform reference data types"
      >
        {totalRecords > 0 && (
          <Badge variant="outline" className="text-sm">
            {totalRecords.toLocaleString()}+ records across {Object.values(counts).filter((c) => c != null).length} tracked types
          </Badge>
        )}
      </AdminHeader>

      {/* Grouped categories */}
      <div className="space-y-6">
        {CATEGORIES.map((category) => {
          const types = DATA_TYPES.filter((t) => t.category === category.key);
          if (types.length === 0) return null;
          const CategoryIcon = category.icon;

          return (
            <div key={category.key}>
              <div className="mb-3 flex items-center gap-2">
                <CategoryIcon className={`h-4 w-4 text-${category.color}-500`} />
                <h2 className="text-foreground text-sm font-semibold uppercase tracking-wider">
                  {category.label}
                </h2>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((type) => {
                  const Icon = type.icon;
                  const count = counts[type.key];

                  return (
                    <Link
                      key={type.key}
                      href={type.href}
                      className="glass-card-child group rounded-xl border border-border/50 p-4 transition-all duration-200 hover:scale-[1.01] hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg border border-${type.color}-500/20 bg-${type.color}-500/10 p-2`}>
                            <Icon className={`h-5 w-5 text-${type.color}-500`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-foreground group-hover:text-primary text-sm font-medium transition-colors">
                              {type.label}
                            </h3>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {type.description}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      {/* Count badge */}
                      {count != null ? (
                        <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2">
                          <span className="text-muted-foreground text-xs">Records</span>
                          <span className="text-foreground font-mono text-sm font-medium">
                            {count.toLocaleString()}
                          </span>
                        </div>
                      ) : count === undefined && (
                        govComponents.isLoading || econComponents.isLoading
                      ) ? (
                        <div className="mt-3 border-t border-border/30 pt-2">
                          <Skeleton className="h-4 w-16 ml-auto" />
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
