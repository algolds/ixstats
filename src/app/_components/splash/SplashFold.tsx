"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  MessageSquare,
  Globe,
  Activity,
  TrendingUp,
  Network,
  Building2,
  MessageCircle,
  Blocks,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Marquee } from "~/components/magicui/marquee";
import {
  ATOMIC_COMPONENTS,
  ComponentType,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import { splashGold } from "~/lib/splash/mycountry-gold";
import { SplashThinkPagesPeek } from "./SplashThinkPagesPeek";

function getMarqueeComponentTypes(): ComponentType[] {
  const raw: ComponentType[] = [
    ComponentType.DEMOCRATIC_PROCESS,
    ComponentType.FEDERAL_SYSTEM,
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.RULE_OF_LAW,
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.TECHNOCRATIC_PROCESS,
    ComponentType.ELECTORAL_LEGITIMACY,
    ComponentType.AUTOCRATIC_PROCESS,
    ComponentType.FREE_MARKET_SYSTEM,
    ComponentType.KNOWLEDGE_ECONOMY,
    ComponentType.INNOVATION_ECOSYSTEM,
    ComponentType.DIGITAL_GOVERNMENT,
    ComponentType.RESEARCH_AND_DEVELOPMENT,
    ComponentType.ENTREPRENEURSHIP_SUPPORT,
    ComponentType.MIXED_ECONOMY,
    ComponentType.SOCIAL_MARKET_ECONOMY,
    ComponentType.MERIT_BASED_SYSTEM,
    ComponentType.TRANSPARENCY_INITIATIVE,
    ComponentType.ANTI_CORRUPTION,
    ComponentType.E_GOVERNANCE,
    ComponentType.PERFORMANCE_MANAGEMENT,
    ComponentType.ACCOUNTABILITY_FRAMEWORK,
    ComponentType.STRATEGIC_PLANNING,
    ComponentType.QUALITY_ASSURANCE,
    ComponentType.UNIVERSAL_HEALTHCARE,
    ComponentType.PUBLIC_EDUCATION,
    ComponentType.MULTILATERAL_DIPLOMACY,
    ComponentType.INTERNATIONAL_LAW,
    ComponentType.WELFARE_STATE,
    ComponentType.ENVIRONMENTAL_PROTECTION,
  ];
  return [...raw].sort((a, b) => String(a).localeCompare(String(b)));
}

function getAtomicCategoryCounts() {
  const vals = Object.values(ATOMIC_COMPONENTS);
  const govSet = new Set(["governance", "process", "legitimacy", "legal", "diplomacy"]);
  const econSet = new Set(["economic", "social", "cultural", "environment"]);
  const adminSet = new Set([
    "administration",
    "planning",
    "technology",
    "security",
    "general",
    "innovation",
    "crisis",
  ]);
  let government = 0;
  let economicSocial = 0;
  let administration = 0;
  for (const c of vals) {
    if (govSet.has(c.category)) government++;
    else if (econSet.has(c.category)) economicSocial++;
    else if (adminSet.has(c.category)) administration++;
    else administration++;
  }
  return {
    total: vals.length,
    government,
    economicSocial,
    administration,
  };
}

export function SplashFold() {
  const marqueeTypes = useMemo(() => getMarqueeComponentTypes(), []);
  const atomicCounts = useMemo(() => getAtomicCategoryCounts(), []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mx-auto mb-16 max-w-7xl md:mb-20"
    >
      <div className="mb-8 text-center">
        <h2 className={`mb-2 text-3xl font-bold tracking-tight md:text-4xl ${splashGold.headline}`}>
          There&apos;s more in the box
        </h2>
        <p className="text-muted-foreground mx-auto max-w-2xl leading-relaxed">
          Lore feeds, component labs, diplomacy tools, Discord — slide in when you&apos;re past the
          opening act.
        </p>
      </div>

      <Tabs defaultValue="thinkpages" className="w-full">
        <div className="mb-6 overflow-x-auto pb-2">
          <TabsList
            className={`inline-flex min-w-full flex-wrap justify-center gap-1 rounded-xl border bg-amber-500/[0.06] p-1 md:min-w-0 dark:bg-amber-950/40 ${splashGold.border} ${splashGold.darkBorder}`}
          >
            <TabsTrigger value="thinkpages" className="text-xs md:text-sm">
              ThinkPages
            </TabsTrigger>
            <TabsTrigger value="atomic" className="text-xs md:text-sm">
              Atomic components
            </TabsTrigger>
            <TabsTrigger value="world" className="text-xs md:text-sm">
              Shared world
            </TabsTrigger>
            <TabsTrigger value="diplomacy" className="text-xs md:text-sm">
              Diplomacy
            </TabsTrigger>
            <TabsTrigger value="community" className="text-xs md:text-sm">
              Community
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="thinkpages">
          <div
            className={`glass-hierarchy-parent rounded-2xl border p-6 md:p-8 ${splashGold.border} ${splashGold.darkBorder}`}
          >
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className={`h-14 w-14 ${splashGold.iconWrap}`}>
                  <MessageSquare className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-foreground text-2xl font-bold md:text-4xl">ThinkPages</h3>
                  <p className="text-muted-foreground text-lg md:text-xl">25 Voices, One Nation</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-base md:text-lg">
                Your nation isn&apos;t a spreadsheet—it&apos;s a society. Create voices from leaders
                to protesters; each shapes your story and feeds the feed.
              </p>

              <SplashThinkPagesPeek />

              <div className="border-border bg-muted/40 rounded-xl border p-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <strong className="text-foreground font-medium">Roleplay with depth:</strong>{" "}
                  opposition parties, news beats, protests — worldbuilding becomes interactive
                  storytelling.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="atomic">
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-foreground mb-3 text-2xl font-bold md:text-4xl">
                Atomic components, full system
              </h3>
              <p className="text-muted-foreground mx-auto max-w-3xl">
                {atomicCounts.total} live components spanning governance, policy, and
                administration. Mix them, and the engine computes synergies, tradeoffs, and
                downstream pressure across your nation.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
              <div className="glass-hierarchy-child border-border rounded-xl border p-4 text-center">
                <div className="text-foreground mb-1 text-3xl font-bold">
                  {atomicCounts.government}
                </div>
                <div className="text-muted-foreground text-sm">Government &amp; legitimacy</div>
              </div>
              <div className="glass-hierarchy-child border-border rounded-xl border p-4 text-center">
                <div className="text-foreground mb-1 text-3xl font-bold">
                  {atomicCounts.economicSocial}
                </div>
                <div className="text-muted-foreground text-sm">Economic &amp; social policy</div>
              </div>
              <div className="glass-hierarchy-child border-border rounded-xl border p-4 text-center">
                <div className="text-foreground mb-1 text-3xl font-bold">
                  {atomicCounts.administration}
                </div>
                <div className="text-muted-foreground text-sm">Administration &amp; systems</div>
              </div>
            </div>

            <div className="relative overflow-hidden">
              <Marquee pauseOnHover className="[--duration:200s]">
                {marqueeTypes.map((type, idx) => {
                  const component = ATOMIC_COMPONENTS[type];
                  if (!component) return null;

                  return (
                    <Card
                      key={`${component.id}-${idx}`}
                      className="glass-hierarchy-child border-border hover:bg-muted/30 w-80 flex-shrink-0 border transition-colors"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                            <Blocks className="text-foreground h-5 w-5" />
                          </div>
                          <CardTitle className="text-base">{component.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {component.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {component.effectiveness}% effective
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {component.synergies.length} synergies
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </Marquee>
            </div>

            <div className="mx-auto max-w-4xl space-y-4">
              <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <strong className="text-foreground font-medium">Interactions:</strong> Components
                  combine for synergy — or clash for story tension.
                </p>
              </div>
              <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <strong className="text-foreground font-medium">Economy:</strong> Policy mixes
                  change GDP, employment, and welfare trajectories over time.
                </p>
              </div>
              <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <strong className="text-foreground font-medium">Systems:</strong> Governance,
                  taxes, and social outcomes interact in one model.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="world">
          <div
            className={`glass-hierarchy-parent rounded-2xl border p-6 md:p-8 ${splashGold.border} ${splashGold.darkBorder}`}
          >
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className={`h-14 w-14 ${splashGold.iconWrap}`}>
                  <Globe className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-foreground text-2xl font-bold md:text-4xl">Shared world</h3>
                  <p className="text-muted-foreground text-lg md:text-xl">
                    Players move, systems answer
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-base md:text-lg">
                Your actions route through one shared clock. Policy edits, issue responses,
                diplomacy, and posting all echo through connected systems, so every player push
                creates visible world response.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                      <Activity className="text-foreground h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold">Shared timeline</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Deadlines, events, and responses resolve on one timeline, so players stay
                    synchronized by design.
                  </p>
                </div>

                <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                      <TrendingUp className="text-foreground h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold">Growing nations</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    National issues and policies feed economic and social systems with measurable
                    consequences.
                  </p>
                </div>

                <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                      <Network className="text-foreground h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold">Impact</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Trade, elections, missions, and feed activity propagate between nations in near
                    real time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="diplomacy">
          <div
            className={`glass-hierarchy-parent rounded-2xl border p-6 md:p-8 ${splashGold.border} ${splashGold.darkBorder}`}
          >
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className={`h-14 w-14 ${splashGold.iconWrap}`}>
                  <Globe className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-foreground text-2xl font-bold md:text-4xl">Diplomacy</h3>
                  <p className="text-muted-foreground text-lg md:text-xl">
                    Relations &amp; outreach
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-base md:text-lg">
                Embassies, missions, alliances, and foreign policy — built for long-running arcs
                from your <strong className="text-foreground font-medium">MyCountry</strong>{" "}
                diplomacy workspace.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                      <Building2 className="text-foreground h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold">Embassies &amp; missions</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Post diplomats, run missions, coordinate during crises or culture weeks.
                  </p>
                </div>

                <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                      <MessageSquare className="text-foreground h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold">Private communications</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Secure channels for treaties, intel swaps, or quiet coordination.
                  </p>
                </div>

                <div className="glass-hierarchy-child border-border rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-lg border">
                      <Network className="text-foreground h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold">Relationships</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Strength and stance tracking for regional storytelling.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="community">
          <div className="space-y-8">
            <div
              className={`glass-hierarchy-parent mx-auto max-w-4xl rounded-2xl border p-6 text-center md:p-8 ${splashGold.border} ${splashGold.darkBorder}`}
            >
              <h3 className={`mb-4 text-2xl font-bold md:text-4xl ${splashGold.headline}`}>
                Community
              </h3>
              <p className="text-muted-foreground mx-auto mb-6 max-w-2xl text-base leading-relaxed md:text-lg">
                Patch notes, feature chat, and other players building the world alongside your
                MyCountry arc.
              </p>
              <a href="https://discord.gg/mgXAEYdqkd" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className={`px-10 py-6 text-lg ${splashGold.border} hover:bg-amber-500/10 dark:hover:bg-amber-950/40`}
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Discord
                </Button>
              </a>
            </div>

            <div
              className={`glass-hierarchy-child mx-auto max-w-4xl rounded-xl border p-5 text-center md:p-6 ${splashGold.subtlePanel}`}
            >
              <p className="text-muted-foreground text-sm md:text-base">
                Import collectible decks through{" "}
                <Link href="/vault/import" className={splashGold.link}>
                  MyVault import
                </Link>
                .
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.section>
  );
}
