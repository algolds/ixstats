"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  ChatBubble as MessageSquare,
  Globe,
  Activity,
  StatUp as TrendingUp,
  Network,
  City as Building2,
  ChatBubble as MessageCircle,
  Component as Blocks,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Marquee } from "~/components/ui/magicui/marquee";
import {
  ATOMIC_COMPONENTS,
  ComponentType,
} from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
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
        <h2 className={`text-large-title mb-2 ${splashGold.headline}`}>
          There&apos;s more in the box
        </h2>
        <p className="text-label-secondary mx-auto max-w-2xl leading-relaxed">
          Lore feeds, component labs, diplomacy tools, Discord — slide in when you&apos;re past the
          opening act.
        </p>
      </div>

      <Tabs defaultValue="thinkpages" className="w-full">
        <div className="mb-6 overflow-x-auto pb-2">
          <TabsList
            className={`rounded-row bg-surface-secondary inline-flex min-w-full flex-wrap justify-center gap-1 border p-1 md:min-w-0 ${splashGold.border} `}
          >
            <TabsTrigger value="thinkpages" className="text-footnote md:text-body">
              ThinkPages
            </TabsTrigger>
            <TabsTrigger value="atomic" className="text-footnote md:text-body">
              Atomic components
            </TabsTrigger>
            <TabsTrigger value="world" className="text-footnote md:text-body">
              Shared world
            </TabsTrigger>
            <TabsTrigger value="diplomacy" className="text-footnote md:text-body">
              Diplomacy
            </TabsTrigger>
            <TabsTrigger value="community" className="text-footnote md:text-body">
              Community
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="thinkpages">
          <div className="material-hero text-label rounded-2xl p-6 md:p-8">
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className={`h-14 w-14 ${splashGold.iconWrap}`}>
                  <MessageSquare className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-label text-title-1 md:text-large-title">ThinkPages</h3>
                  <p className="text-label-secondary text-title-3 md:text-title-2">
                    25 Voices, One Nation
                  </p>
                </div>
              </div>

              <p className="text-label-secondary text-body md:text-title-3 mb-8 max-w-3xl">
                Your nation isn&apos;t a spreadsheet—it&apos;s a society. Create voices from leaders
                to protesters; each shapes your story and feeds the feed.
              </p>

              <SplashThinkPagesPeek />

              <div className="border-separator bg-fill-3 rounded-row border p-4">
                <p className="text-label-secondary text-body leading-relaxed">
                  <strong className="text-label font-medium">Roleplay with depth:</strong>{" "}
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
              <h3 className="text-label text-title-1 md:text-large-title mb-3">
                Atomic components, full system
              </h3>
              <p className="text-label-secondary mx-auto max-w-3xl">
                {atomicCounts.total} live components spanning governance, policy, and
                administration. Mix them, and the engine computes synergies, tradeoffs, and
                downstream pressure across your nation.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
              <div className="bg-surface-secondary rounded-row p-4 text-center">
                <div className="text-label text-large-title mb-1">{atomicCounts.government}</div>
                <div className="text-label-secondary text-body">Government &amp; legitimacy</div>
              </div>
              <div className="bg-surface-secondary rounded-row p-4 text-center">
                <div className="text-label text-large-title mb-1">
                  {atomicCounts.economicSocial}
                </div>
                <div className="text-label-secondary text-body">Economic &amp; social policy</div>
              </div>
              <div className="bg-surface-secondary rounded-row p-4 text-center">
                <div className="text-label text-large-title mb-1">
                  {atomicCounts.administration}
                </div>
                <div className="text-label-secondary text-body">Administration &amp; systems</div>
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
                      className="bg-surface-secondary hover:bg-fill-4 flex w-80 shrink-0 flex-col gap-6 py-6 transition-colors"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                            <Blocks className="text-label h-5 w-5" />
                          </div>
                          <CardTitle className="text-body">{component.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-label-secondary text-footnote line-clamp-2">
                          {component.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default" className="text-footnote">
                            {component.effectiveness}% effective
                          </Badge>
                          <Badge variant="outline" className="text-footnote">
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
              <div className="bg-surface-secondary rounded-row p-4">
                <p className="text-label-secondary text-body leading-relaxed">
                  <strong className="text-label font-medium">Interactions:</strong> Components
                  combine for synergy — or clash for story tension.
                </p>
              </div>
              <div className="bg-surface-secondary rounded-row p-4">
                <p className="text-label-secondary text-body leading-relaxed">
                  <strong className="text-label font-medium">Economy:</strong> Policy mixes change
                  GDP, employment, and welfare trajectories over time.
                </p>
              </div>
              <div className="bg-surface-secondary rounded-row p-4">
                <p className="text-label-secondary text-body leading-relaxed">
                  <strong className="text-label font-medium">Systems:</strong> Governance, taxes,
                  and social outcomes interact in one model.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="world">
          <div className="material-hero text-label rounded-2xl p-6 md:p-8">
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className={`h-14 w-14 ${splashGold.iconWrap}`}>
                  <Globe className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-label text-title-1 md:text-large-title">Shared world</h3>
                  <p className="text-label-secondary text-title-3 md:text-title-2">
                    Players move, systems answer
                  </p>
                </div>
              </div>

              <p className="text-label-secondary text-body md:text-title-3 mb-8 max-w-3xl">
                Your actions route through one shared clock. Policy edits, issue responses,
                diplomacy, and posting all echo through connected systems, so every player push
                creates visible world response.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                      <Activity className="text-label h-6 w-6" />
                    </div>
                    <h4 className="text-headline">Shared timeline</h4>
                  </div>
                  <p className="text-label-secondary text-body">
                    Deadlines, events, and responses resolve on one timeline, so players stay
                    synchronized by design.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                      <TrendingUp className="text-label h-6 w-6" />
                    </div>
                    <h4 className="text-headline">Growing nations</h4>
                  </div>
                  <p className="text-label-secondary text-body">
                    National issues and policies feed economic and social systems with measurable
                    consequences.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                      <Network className="text-label h-6 w-6" />
                    </div>
                    <h4 className="text-headline">Impact</h4>
                  </div>
                  <p className="text-label-secondary text-body">
                    Trade, elections, missions, and feed activity propagate between nations in near
                    real time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="diplomacy">
          <div className="material-hero text-label rounded-2xl p-6 md:p-8">
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className={`h-14 w-14 ${splashGold.iconWrap}`}>
                  <Globe className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-label text-title-1 md:text-large-title">Diplomacy</h3>
                  <p className="text-label-secondary text-title-3 md:text-title-2">
                    Relations &amp; outreach
                  </p>
                </div>
              </div>

              <p className="text-label-secondary text-body md:text-title-3 mb-8 max-w-3xl">
                Embassies, missions, alliances, and foreign policy — built for long-running arcs
                from your <strong className="text-label font-medium">MyCountry</strong> diplomacy
                workspace.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                      <Building2 className="text-label h-6 w-6" />
                    </div>
                    <h4 className="text-headline">Embassies &amp; missions</h4>
                  </div>
                  <p className="text-label-secondary text-body">
                    Post diplomats, run missions, coordinate during crises or culture weeks.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                      <MessageSquare className="text-label h-6 w-6" />
                    </div>
                    <h4 className="text-headline">Private communications</h4>
                  </div>
                  <p className="text-label-secondary text-body">
                    Secure channels for treaties, intel swaps, or quiet coordination.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 items-center justify-center border">
                      <Network className="text-label h-6 w-6" />
                    </div>
                    <h4 className="text-headline">Relationships</h4>
                  </div>
                  <p className="text-label-secondary text-body">
                    Strength and stance tracking for regional storytelling.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="community">
          <div className="space-y-8">
            <div className="material-hero text-label mx-auto max-w-4xl rounded-2xl p-6 text-center md:p-8">
              <h3 className={`text-title-1 md:text-large-title mb-4 ${splashGold.headline}`}>
                Community
              </h3>
              <p className="text-label-secondary text-body md:text-title-3 mx-auto mb-6 max-w-2xl leading-relaxed">
                Patch notes, feature chat, and other players building the world alongside your
                MyCountry arc.
              </p>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-tint/40 hover:bg-tint-fill"
              >
                <a href="https://discord.gg/mgXAEYdqkd" target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" className="mr-2 h-5 w-5" />
                  Discord
                </a>
              </Button>
            </div>

            <div
              className={`bg-surface-secondary rounded-row mx-auto max-w-4xl p-5 text-center md:p-6 ${splashGold.subtlePanel}`}
            >
              <p className="text-label-secondary text-body md:text-body">
                Collect lore cards, earn IxCredits, and unlock achievements in the{" "}
                <Link href="/vault" className={splashGold.link}>
                  MyVault
                </Link>
                . Play NationStates? You can{" "}
                <Link href="/vault/import" className={splashGold.link}>
                  import your deck
                </Link>{" "}
                too.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.section>
  );
}
