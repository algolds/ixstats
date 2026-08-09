"use client";

import React, { useState, useEffect } from "react";
import {
  Command,
  Loader2,
  SlidersHorizontal,
  Users2,
  Compass,
  Shield,
  Building2,
  Dices,
  Calendar,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Layers,
  ChevronRight,
  Zap,
  X,
  HelpCircle,
  BookOpen,
  FileClock,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetContainer, FacetCard } from "~/components/ui/facet-container";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { useCountryData } from "./CountryDataProvider";

type Tone = "good" | "mid" | "bad" | "fog" | "info";

const TONE_CLS: Record<Tone, string> = {
  good: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  mid: "text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
  bad: "text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/30",
  info: "text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
  fog: "text-muted-foreground bg-muted/20 border-border/40",
};

interface DomesticSuggestion {
  category: string;
  label: string;
  keywords: string[];
  icon: string;
}

const DOMESTIC_SUGGESTIONS: DomesticSuggestion[] = [
  // Economy (8 presets)
  {
    category: "Economy",
    label: "Cool the housing market",
    keywords: ["housing", "market", "rent", "property", "house"],
    icon: "🏠",
  },
  {
    category: "Economy",
    label: "Create industrial manufacturing jobs",
    keywords: ["job", "manufacturing", "employ", "labor", "work"],
    icon: "🏭",
  },
  {
    category: "Economy",
    label: "Increase the minimum wage",
    keywords: ["wage", "minimum", "pay", "income"],
    icon: "💵",
  },
  {
    category: "Economy",
    label: "Subsidize small business innovation",
    keywords: ["business", "innovation", "startup", "subsidy"],
    icon: "💡",
  },
  {
    category: "Economy",
    label: "Expand agricultural export subsidies",
    keywords: ["farm", "agriculture", "food", "export"],
    icon: "🌾",
  },
  {
    category: "Economy",
    label: "De-regulate commercial banking sectors",
    keywords: ["bank", "finance", "deregulate", "credit"],
    icon: "🏦",
  },
  {
    category: "Economy",
    label: "Attract foreign direct investment",
    keywords: ["foreign", "investment", "capital", "trade"],
    icon: "🌐",
  },
  {
    category: "Economy",
    label: "Establish tech hub tax incentives",
    keywords: ["tech", "digital", "incentive", "tax"],
    icon: "💻",
  },

  // Fiscal (8 presets)
  {
    category: "Fiscal",
    label: "Rein in inflation and price volatility",
    keywords: ["inflation", "price", "cost", "consumer"],
    icon: "📈",
  },
  {
    category: "Fiscal",
    label: "Reduce national budget deficit",
    keywords: ["debt", "deficit", "spend", "tax"],
    icon: "📊",
  },
  {
    category: "Fiscal",
    label: "Reform progressive corporate income tax",
    keywords: ["tax", "corporate", "revenue", "fiscal"],
    icon: "🏛️",
  },
  {
    category: "Fiscal",
    label: "Implement strict austerity measures",
    keywords: ["austerity", "cut", "spending", "fiscal"],
    icon: "✂️",
  },
  {
    category: "Fiscal",
    label: "Issue sovereign wealth investment bonds",
    keywords: ["bond", "sovereign", "wealth", "treasury"],
    icon: "📜",
  },
  {
    category: "Fiscal",
    label: "Audit government administrative waste",
    keywords: ["audit", "efficiency", "waste", "spending"],
    icon: "🔍",
  },
  {
    category: "Fiscal",
    label: "Establish rainy-day stabilization reserve",
    keywords: ["reserve", "fund", "saving", "fiscal"],
    icon: "🏦",
  },
  {
    category: "Fiscal",
    label: "Cap national debt-to-GDP ratio",
    keywords: ["debt", "gdp", "ceiling", "fiscal"],
    icon: "⚓",
  },

  // Social (8 presets)
  {
    category: "Social",
    label: "Invest in public school education",
    keywords: ["education", "school", "teach", "learn"],
    icon: "📚",
  },
  {
    category: "Social",
    label: "Improve healthcare and hospital access",
    keywords: ["health", "hospital", "medical", "doctor"],
    icon: "🏥",
  },
  {
    category: "Social",
    label: "Expand social welfare safety net",
    keywords: ["welfare", "poverty", "support", "benefit"],
    icon: "🤝",
  },
  {
    category: "Social",
    label: "Launch universal childcare subsidies",
    keywords: ["childcare", "family", "parent", "support"],
    icon: "👶",
  },
  {
    category: "Social",
    label: "Modernize public pension retirement funds",
    keywords: ["pension", "retire", "senior", "elder"],
    icon: "👵",
  },
  {
    category: "Social",
    label: "Fund national mental health initiatives",
    keywords: ["mental", "wellness", "health", "care"],
    icon: "🧠",
  },
  {
    category: "Social",
    label: "Eradicate urban homelessness",
    keywords: ["homeless", "shelter", "housing", "urban"],
    icon: "🛖",
  },
  {
    category: "Social",
    label: "Subsidize university tuition grants",
    keywords: ["university", "college", "tuition", "grant"],
    icon: "🎓",
  },

  // Infrastructure (8 presets)
  {
    category: "Infrastructure",
    label: "Develop national highway transit",
    keywords: ["road", "highway", "transit", "infrastructure", "bridge"],
    icon: "🛣️",
  },
  {
    category: "Infrastructure",
    label: "Upgrade the national energy power grid",
    keywords: ["grid", "energy", "power", "electricity"],
    icon: "⚡",
  },
  {
    category: "Infrastructure",
    label: "Construct high-speed rail corridor",
    keywords: ["rail", "train", "transit", "speed"],
    icon: "🚆",
  },
  {
    category: "Infrastructure",
    label: "Modernize deepwater shipping seaports",
    keywords: ["port", "ship", "sea", "cargo"],
    icon: "⚓",
  },
  {
    category: "Infrastructure",
    label: "Expand nationwide high-speed fiber internet",
    keywords: ["internet", "broadband", "fiber", "network"],
    icon: "📡",
  },
  {
    category: "Infrastructure",
    label: "Build renewable solar and wind farms",
    keywords: ["solar", "wind", "renewable", "clean"],
    icon: "🌱",
  },
  {
    category: "Infrastructure",
    label: "Upgrade urban water treatment plants",
    keywords: ["water", "sanitation", "utility", "urban"],
    icon: "💧",
  },
  {
    category: "Infrastructure",
    label: "Construct modern international airports",
    keywords: ["airport", "aviation", "flight", "travel"],
    icon: "✈️",
  },

  // Security (8 presets)
  {
    category: "Security",
    label: "Reduce urban crime rates and violence",
    keywords: ["crime", "police", "security", "safety", "order"],
    icon: "👮",
  },
  {
    category: "Security",
    label: "Increase community policing and patrols",
    keywords: ["police", "patrol", "community", "street"],
    icon: "🚔",
  },
  {
    category: "Security",
    label: "Crack down on organized syndicate corruption",
    keywords: ["gang", "corruption", "syndicate", "law"],
    icon: "⚖️",
  },
  {
    category: "Security",
    label: "Enhance border patrol border control",
    keywords: ["border", "patrol", "immigration", "customs"],
    icon: "🛂",
  },
  {
    category: "Security",
    label: "Fortify national cybersecurity infrastructure",
    keywords: ["cyber", "hacker", "security", "digital"],
    icon: "🛡️",
  },
  {
    category: "Security",
    label: "Reform judicial court trial throughput",
    keywords: ["court", "judge", "justice", "law"],
    icon: "⚖️",
  },
  {
    category: "Security",
    label: "Implement anti-smuggling taskforces",
    keywords: ["smuggling", "drugs", "customs", "enforce"],
    icon: "🚨",
  },
  {
    category: "Security",
    label: "Expand emergency responder coverage",
    keywords: ["fire", "ambulance", "rescue", "emergency"],
    icon: "🚒",
  },

  // Defense (8 presets)
  {
    category: "Defense",
    label: "Modernize armed forces equipment",
    keywords: ["military", "navy", "army", "defense", "forces"],
    icon: "🛡️",
  },
  {
    category: "Defense",
    label: "Expand naval fleet patrol capacity",
    keywords: ["navy", "ship", "fleet", "sea"],
    icon: "🚢",
  },
  {
    category: "Defense",
    label: "Upgrade air force fighter jet fleet",
    keywords: ["airforce", "jet", "plane", "sky"],
    icon: "✈️",
  },
  {
    category: "Defense",
    label: "Increase military enlistment pay and benefits",
    keywords: ["pay", "recruit", "soldier", "enlist"],
    icon: "🎖️",
  },
  {
    category: "Defense",
    label: "Fortify strategic coastal defense batteries",
    keywords: ["coastal", "fortify", "bunker", "battery"],
    icon: "🏰",
  },
  {
    category: "Defense",
    label: "Invest in autonomous defense technology",
    keywords: ["drone", "tech", "autonomous", "robot"],
    icon: "🤖",
  },
  {
    category: "Defense",
    label: "Expand intelligence counter-espionage ops",
    keywords: ["intel", "spy", "secret", "recon"],
    icon: "🕵️",
  },
  {
    category: "Defense",
    label: "Establish rapid disaster response military units",
    keywords: ["disaster", "relief", "response", "conscript"],
    icon: "⛑️",
  },

  // Diplomacy (8 presets)
  {
    category: "Diplomacy",
    label: "Negotiate bilateral free trade treaties",
    keywords: ["trade", "treaty", "alliance", "diplomacy"],
    icon: "🤝",
  },
  {
    category: "Diplomacy",
    label: "Expand foreign embassy diplomatic network",
    keywords: ["embassy", "diplomat", "foreign", "envoy"],
    icon: "🏛️",
  },
  {
    category: "Diplomacy",
    label: "Mediate international border disputes",
    keywords: ["peace", "dispute", "border", "negotiate"],
    icon: "🕊️",
  },
  {
    category: "Diplomacy",
    label: "Host global economic summit",
    keywords: ["summit", "global", "leader", "conference"],
    icon: "🌐",
  },
  {
    category: "Diplomacy",
    label: "Offer humanitarian foreign aid packages",
    keywords: ["aid", "humanitarian", "help", "relief"],
    icon: "❤️",
  },
  {
    category: "Diplomacy",
    label: "Form regional mutual defense pacts",
    keywords: ["pact", "defense", "alliance", "security"],
    icon: "🛡️",
  },
  {
    category: "Diplomacy",
    label: "Join international climate standards",
    keywords: ["climate", "green", "treaty", "standard"],
    icon: "🌍",
  },
  {
    category: "Diplomacy",
    label: "Apply for international trade council seat",
    keywords: ["council", "trade", "global", "seat"],
    icon: "🎖️",
  },

  // Governance (8 presets)
  {
    category: "Governance",
    label: "Streamline civil service bureau efficiency",
    keywords: ["bureau", "civil", "service", "efficiency"],
    icon: "🏛️",
  },
  {
    category: "Governance",
    label: "Enact strict anti-corruption transparency laws",
    keywords: ["corruption", "law", "transparency", "ethics"],
    icon: "📜",
  },
  {
    category: "Governance",
    label: "Decentralize regional administrative power",
    keywords: ["decentralize", "region", "local", "governor"],
    icon: "🗺️",
  },
  {
    category: "Governance",
    label: "Implement digital e-government portal",
    keywords: ["digital", "egov", "online", "portal"],
    icon: "🖥️",
  },
  {
    category: "Governance",
    label: "Establish independent judiciary oversight",
    keywords: ["court", "judicial", "oversight", "law"],
    icon: "⚖️",
  },
  {
    category: "Governance",
    label: "Reform parliamentary voting procedures",
    keywords: ["vote", "parliament", "election", "reform"],
    icon: "🗳️",
  },
  {
    category: "Governance",
    label: "Enforce cabinet minister performance metrics",
    keywords: ["cabinet", "minister", "performance", "metric"],
    icon: "📋",
  },
  {
    category: "Governance",
    label: "Launch public freedom of information act",
    keywords: ["information", "access", "transparency", "public"],
    icon: "📖",
  },
];

const DOMAIN_CATEGORIES = [
  "All",
  "Economy",
  "Fiscal",
  "Social",
  "Infrastructure",
  "Security",
  "Defense",
  "Diplomacy",
  "Governance",
];

const BROKER_ICONS: Record<string, React.ComponentType<any>> = {
  technocrats: Compass,
  party: Users2,
  generals: Shield,
  magnates: Building2,
  clergy: Compass,
};

interface IntentComposerProps {
  countryId: string;
  initialGoal?: string;
  onCommitted: (res: any) => void;
}

export function IntentComposer({ countryId, initialGoal = "", onCommitted }: IntentComposerProps) {
  const { country } = useCountryData();
  const [q, setQ] = useState(initialGoal);
  const [goal, setGoal] = useState<string | null>(initialGoal || null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [err, setErr] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [chainOf, setChainOf] = useState<string | null>(null);
  const [justCommitted, setJustCommitted] = useState<{ id: string; goal: string } | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (typeof initialGoal === "string" && initialGoal.trim()) {
      setQ(initialGoal);
      setGoal(initialGoal);
    }
  }, [initialGoal]);

  const safeGoal = typeof goal === "string" ? goal : "";

  const suggest = api.intent.suggest.useQuery(
    { countryId, goal: safeGoal },
    { enabled: typeof goal === "string" && safeGoal.trim().length >= 2 }
  );

  const { data: brokers } = api.elections.getPowerBrokers.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const intentStatusQuery = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });
  const intentStatus = intentStatusQuery.data;
  const usedSlots = intentStatus?.usedThisWeek ?? 0;
  const capSlots = intentStatus?.cap ?? 3;
  const availableSlots = Math.max(0, capSlots - usedSlots);

  React.useEffect(() => {
    if (suggest.error) {
      setErr(suggest.error.message);
      setGoal(null);
    }
  }, [suggest.error]);

  const commitM = api.intent.commit.useMutation({
    onSuccess: (res) => {
      onCommitted(res);
      setGoal(null);
      setQ("");
      setParentId(null);
      setChainOf(null);
      setJustCommitted({ id: res.intent.id, goal: res.intent.goal });
    },
    onError: (e) => setErr(e.message),
  });

  const propose = (g: unknown) => {
    setErr(null);
    if (typeof g === "string" && g.trim().length >= 2) {
      setGoal(g.trim());
    }
  };

  const commitTier = (tier: string) => {
    setErr(null);
    commitM.mutate({
      countryId,
      goal: goal!,
      tier: tier as any,
      parentId: parentId ?? undefined,
    });
  };

  /** Real-time Telemetry Reactive 'Surprise Me' engine */
  const getRandomGoal = () => {
    // Check country telemetry metrics for targeted reactive suggestions
    if (country) {
      const crimeRate = country.crimeRate ?? 45;
      const readiness = country.militaryReadiness ?? country.readiness ?? 94;
      const stability = country.currentStability ?? country.stability ?? 0.78;
      const approval = country.publicApproval ?? 68;

      if (crimeRate > 50) {
        const item =
          DOMESTIC_SUGGESTIONS.find((s) => s.label === "Reduce urban crime rates and violence") ??
          DOMESTIC_SUGGESTIONS[0];
        setQ(item.label);
        propose(item.label);
        return;
      }
      if (readiness < 80) {
        const item =
          DOMESTIC_SUGGESTIONS.find((s) => s.label === "Modernize armed forces equipment") ??
          DOMESTIC_SUGGESTIONS[0];
        setQ(item.label);
        propose(item.label);
        return;
      }
      if (stability < 0.6) {
        const item =
          DOMESTIC_SUGGESTIONS.find(
            (s) => s.label === "Enact strict anti-corruption transparency laws"
          ) ?? DOMESTIC_SUGGESTIONS[0];
        setQ(item.label);
        propose(item.label);
        return;
      }
      if (approval < 50) {
        const item =
          DOMESTIC_SUGGESTIONS.find((s) => s.label === "Expand social welfare safety net") ??
          DOMESTIC_SUGGESTIONS[0];
        setQ(item.label);
        propose(item.label);
        return;
      }
    }

    const available =
      activeCategory === "All"
        ? DOMESTIC_SUGGESTIONS
        : DOMESTIC_SUGGESTIONS.filter((s) => s.category === activeCategory);
    const item = available[Math.floor(Math.random() * available.length)];
    if (item) {
      setQ(item.label);
      propose(item.label);
    }
  };

  const data = suggest.data;
  const status = data?.status;
  const canCommit = (status?.canCommit ?? true) && !commitM.isPending;
  const activeBrokers = brokers?.filter((b) => b.unlocked) || [];

  const filteredSuggestions =
    activeCategory === "All"
      ? DOMESTIC_SUGGESTIONS
      : DOMESTIC_SUGGESTIONS.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Power Broker Telemetry Strip (Cabinet Alignment Context) */}
      {activeBrokers.length > 0 && (
        <div className="flex scrollbar-none items-center gap-2 overflow-x-auto pb-1">
          <span className="text-muted-foreground shrink-0 text-[9px] font-extrabold tracking-wider uppercase">
            Cabinet Alignments:
          </span>
          {activeBrokers.map((b) => {
            const Icon = BROKER_ICONS[b.keyRequirement] || Users2;
            const moodCls = b.satisfied
              ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";

            return (
              <div
                key={b.name}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-all",
                  moodCls
                )}
                title={`${b.name}: ${b.satisfied ? "Satisfied" : "Restless"} (${Math.round((b.powerShare ?? 0) * 100)}% power share)`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{b.name}</span>
                <span className="text-[9px] opacity-60">
                  ({Math.round((b.powerShare ?? 0) * 100)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Executive Command Input Bar — Apple Spotlight Glass Styling */}
      <div className="w-full min-w-0 space-y-3">
        {/* Telemetry & Action Row Above Main Container */}
        <div className="flex w-full items-center justify-between gap-2 px-1">
          {/* Help / Guide & Tips Button */}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-500 shadow-2xs backdrop-blur-md transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
          >
            <HelpCircle className="h-3 w-3 shrink-0 text-amber-500" />
            <span>Guide & Tips</span>
          </button>

          {/* Weekly Directive Slots Telemetry Badge (macOS Capsule Style) */}
          <div
            className={cn(
              "inline-flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold shadow-2xs backdrop-blur-md transition-all",
              usedSlots >= capSlots
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-border/40 bg-card/20 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-500 dark:hover:text-amber-400"
            )}
            title={`${usedSlots}/${capSlots} weekly directive slots consumed (${availableSlots} available)`}
          >
            <FileClock className="h-3 w-3 shrink-0" />
            <span>
              {usedSlots}/{capSlots} Slots Used
            </span>
            <span className="font-mono opacity-60">({availableSlots} Available)</span>
          </div>
        </div>

        {/* Spotlight-Style Floating Translucent Command Pill Container */}
        <div
          className={cn(
            "group bg-background/60 relative flex w-full min-w-0 items-center gap-3 rounded-2xl border border-white/10 p-3.5 shadow-lg backdrop-blur-2xl transition-all duration-300 ease-out dark:border-white/15 dark:bg-zinc-900/60",
            "hover:bg-background/80 hover:border-amber-500/40 hover:shadow-xl",
            "focus-within:bg-background/90 focus-within:border-amber-500/60 focus-within:shadow-2xl focus-within:ring-4 focus-within:ring-amber-500/10"
          )}
        >
          {/* Subtle Ambient Glow Effect on Focus */}
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20 opacity-0 blur-md transition-opacity duration-300 group-focus-within:opacity-100" />

          <div className="relative flex w-full min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            {/* Leading Icon with subtle status glow */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 transition-transform duration-200 group-focus-within:scale-105">
              <Command className="h-4.5 w-4.5" />
            </div>

            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") propose(q);
              }}
              placeholder="What is your country trying to achieve?"
              className="placeholder:text-muted-foreground/50 text-foreground min-w-[160px] flex-1 bg-transparent text-base font-semibold tracking-tight outline-none sm:text-lg"
            />

            {/* INLINE Suggested Action Quick Chips (rendered when search input is empty) */}
            {!q && (
              <div className="flex max-w-full shrink-0 scrollbar-none items-center gap-1.5 overflow-x-auto py-0.5 sm:max-w-none">
                <button
                  type="button"
                  onClick={() => {
                    setQ("Rein in inflation and stabilize prices");
                    propose("Rein in inflation and stabilize prices");
                  }}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-500 transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
                >
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>Tackle Inflation</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQ("Cool the housing market");
                    propose("Cool the housing market");
                  }}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-95"
                >
                  <Building2 className="h-3 w-3 text-cyan-400" />
                  <span>Cool Housing</span>
                </button>

                <button
                  type="button"
                  onClick={getRandomGoal}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] font-bold text-purple-400 transition-all hover:bg-purple-500/20 active:scale-95"
                >
                  <Dices className="h-3 w-3 text-purple-400" />
                  <span>Surprise Me</span>
                </button>
              </div>
            )}

            {/* Clear Button */}
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setGoal(null);
                }}
                className="bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all active:scale-90"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Action Handoff Button (Apple Return Pill) */}
            {suggest.isFetching ? (
              <div className="flex h-8 shrink-0 items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 text-xs font-bold text-amber-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Analyzing…</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => propose(q)}
                disabled={!q.trim()}
                className={cn(
                  "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-all duration-200 active:scale-95",
                  q.trim()
                    ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/30"
                    : "border-border/30 bg-muted/30 text-muted-foreground/40 cursor-not-allowed border"
                )}
              >
                <span>Propose</span>
                <span className="py-0.2 rounded bg-black/15 px-1 font-mono text-[9px] font-extrabold dark:bg-black/20">
                  ⏎
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {chainOf && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-500 dark:text-amber-300">
          ↳ continuing: <span className="font-bold">{chainOf}</span>
          <button
            onClick={() => {
              setParentId(null);
              setChainOf(null);
            }}
            className="ml-auto cursor-pointer text-amber-500/70 hover:text-amber-500"
          >
            ✕
          </button>
        </div>
      )}

      {justCommitted && !goal && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-500 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Committed: <strong className="font-bold">{justCommitted.goal}</strong>
          </span>
          <button
            onClick={() => {
              setParentId(justCommitted.id);
              setChainOf(justCommitted.goal);
              setJustCommitted(null);
            }}
            className="ml-auto cursor-pointer rounded-lg border border-emerald-500/40 px-2.5 py-1 font-bold transition-colors hover:bg-emerald-500/20"
          >
            Build on this →
          </button>
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-500 dark:text-red-300">
          {err}
        </div>
      )}

      {status && !status.canCommit && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-500 dark:text-amber-200">
          Your government is executing this week's agenda ({status.usedThisWeek}/{status.cap}). New
          intents open after the weekly cooldown.
        </div>
      )}

      {!goal ? (
        <div className="space-y-4">
          {/* Autocomplete Search Matches */}
          {q.trim().length > 0 && (
            <div className="border-border/50 bg-popover/95 rounded-xl border p-3 shadow-2xl backdrop-blur-xl">
              <div className="text-muted-foreground px-1 py-1 text-[10px] font-extrabold tracking-widest uppercase">
                Matching Suggestions
              </div>
              <div className="mt-1.5 max-h-[220px] space-y-1 overflow-y-auto">
                {DOMESTIC_SUGGESTIONS.filter(
                  (s) =>
                    s.label.toLowerCase().includes(q.toLowerCase()) ||
                    s.keywords.some((k) => k.includes(q.toLowerCase()))
                ).map((s) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      setQ(s.label);
                      setErr(null);
                      propose(s.label);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-left text-xs transition-all hover:border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-500"
                  >
                    <span className="text-sm">{s.icon}</span>
                    <span className="text-foreground/90 font-semibold">{s.label}</span>
                    <span className="text-muted-foreground/70 bg-muted/40 border-border/30 ml-auto rounded border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase">
                      {s.category}
                    </span>
                  </button>
                ))}
                {DOMESTIC_SUGGESTIONS.filter(
                  (s) =>
                    s.label.toLowerCase().includes(q.toLowerCase()) ||
                    s.keywords.some((k) => k.includes(q.toLowerCase()))
                ).length === 0 && (
                  <div className="text-muted-foreground py-4 text-center text-xs font-medium">
                    No matching predefined goals. Press Enter to search custom intent.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Predefined Suggestion Grid & Category Pills */}
          {q.trim().length === 0 && (
            <div className="space-y-3">
              {/* Category Segmented Selector Pills */}
              <div className="border-border/30 flex items-center justify-between gap-2 border-b pb-2">
                <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest uppercase">
                  <Compass className="h-3.5 w-3.5 text-amber-500" />
                  Suggested Goals
                </div>
                <div className="flex scrollbar-none items-center gap-1 overflow-x-auto">
                  {DOMAIN_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition-all active:scale-95",
                        activeCategory === cat
                          ? "border border-amber-500/40 bg-amber-500/20 text-amber-500 shadow-sm"
                          : "bg-muted/20 text-muted-foreground hover:text-foreground border-border/30 border"
                      )}
                    >
                      {cat}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPolicyOpen(true)}
                    className="ml-1 flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-500 shadow-2xs transition-all hover:bg-amber-500/25 active:scale-95"
                  >
                    <SlidersHorizontal className="h-3 w-3 text-amber-500" />
                    <span>Tune Custom Directive</span>
                  </button>
                </div>
              </div>

              {/* Filtered Grid of Goals */}
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from(new Set(filteredSuggestions.map((s) => s.category))).map((cat) => (
                  <FacetCard
                    key={cat}
                    depth={2}
                    className="bg-card/40 border-border/30 space-y-2 p-3.5"
                  >
                    <div className="border-border/30 flex items-center justify-between border-b pb-1 text-[10px] font-extrabold tracking-wider text-amber-500 uppercase">
                      <span>{cat}</span>
                      <span className="text-muted-foreground/60 text-[9px]">
                        {filteredSuggestions.filter((s) => s.category === cat).length} actions
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {filteredSuggestions
                        .filter((s) => s.category === cat)
                        .map((s) => (
                          <button
                            key={s.label}
                            onClick={() => {
                              setQ(s.label);
                              setErr(null);
                              propose(s.label);
                            }}
                            className="group bg-muted/20 border-border/20 text-foreground/90 flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-500 active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-2">
                              <span>{s.icon}</span>
                              <span>{s.label}</span>
                            </div>
                            <ChevronRight className="text-muted-foreground/40 h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </button>
                        ))}
                    </div>
                  </FacetCard>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : suggest.isFetching || !data ? (
        <div className="text-muted-foreground px-1 py-8 text-center text-sm font-medium">
          <Loader2 className="mx-auto mb-2.5 h-6 w-6 animate-spin text-amber-500" />
          Your cabinet ministries are evaluating policy options…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 px-1 text-xs font-extrabold tracking-wide text-amber-500 uppercase dark:text-amber-400">
            <Command className="h-3.5 w-3.5" />
            <span>“{goal}”</span>
            {data.category && (
              <span className="text-muted-foreground font-mono text-[11px] lowercase">
                · {data.category}
              </span>
            )}
          </div>

          {/* Package Tier Options — Facet Depth Cards with Apple Motion */}
          {data.packages.map((p: any) => (
            <button
              key={p.tier}
              disabled={!canCommit}
              onClick={() => commitTier(p.tier)}
              className="group relative w-full cursor-pointer text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FacetCard
                depth={2}
                className="bg-card/40 border-border/40 p-4 transition-all duration-200 group-hover:border-amber-500/50 group-hover:bg-amber-500/[0.04] group-hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <span>{p.title}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                      TONE_CLS[p.acceptance as Tone]
                    )}
                  >
                    {p.acceptance === "good"
                      ? "Broad support"
                      : p.acceptance === "mid"
                        ? "Contested"
                        : "Hard sell"}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1.5 text-xs leading-relaxed font-medium">
                  {p.blurb}
                </div>
                <ul className="border-border/30 mt-3 space-y-1.5 border-t pt-2.5">
                  {p.changes.map((c: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="mt-[2px] text-xs font-bold text-amber-500">
                        {c.kind === "budget"
                          ? "▤"
                          : c.kind === "policy"
                            ? "◈"
                            : c.kind === "foreign"
                              ? "◇"
                              : "•"}
                      </span>
                      <span className="text-foreground/90 leading-normal font-medium">
                        {c.label}
                        <span className="text-muted-foreground font-normal"> — {c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-muted-foreground/80 border-border/30 mt-3 flex items-center justify-between border-t pt-2 text-[9px] font-extrabold tracking-wider uppercase">
                  <span>Risk: {p.risk}</span>
                  <div className="flex items-center gap-1 font-bold text-amber-500">
                    <span>Commit Directive</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </FacetCard>
            </button>
          ))}

          {/* Propose for Deliberation Card */}
          <button
            onClick={() => {
              setErr(null);
              commitM.mutate({
                countryId,
                goal: goal!,
                tier: "proposed",
                parentId: parentId ?? undefined,
              });
            }}
            className="group w-full cursor-pointer text-left transition-all active:scale-[0.99]"
          >
            <FacetCard
              depth={1}
              className="border border-dashed border-amber-500/40 bg-amber-500/5 p-4 transition-all duration-200 group-hover:border-amber-500/60 group-hover:bg-amber-500/10 group-hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-amber-500 dark:text-amber-300">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Propose as Cabinet Goal</span>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-500 uppercase dark:text-amber-300">
                  Schedule meeting
                </span>
              </div>
              <div className="text-muted-foreground mt-1.5 text-xs leading-relaxed font-medium">
                Add this goal to the national proposed agenda list. This allows scheduling a
                dedicated cabinet meeting session to deliberate and select a ministry package.
                (Bypasses active weekly cooldown).
              </div>
            </FacetCard>
          </button>

          {data.broker && (
            <div className="text-muted-foreground px-1 text-[11px] font-medium">
              Acceptance weighted by{" "}
              <span className="text-foreground font-semibold">{data.broker.name}</span>
              {data.broker.unlocked
                ? data.broker.satisfied
                  ? " · satisfied"
                  : " · restless"
                : " · not factor"}
              .
            </div>
          )}

          <div className="flex items-center justify-between px-1 pt-2">
            <button
              onClick={() => setGoal(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-semibold transition-colors"
            >
              ← Rethink goal
            </button>
            <button
              onClick={() => setPolicyOpen(true)}
              className="flex cursor-pointer items-center gap-1 text-xs font-bold text-amber-500 transition-colors hover:text-amber-400"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Draft custom package →
            </button>
          </div>
        </div>
      )}

      <PolicyCreatorSheet countryId={countryId} open={policyOpen} onOpenChange={setPolicyOpen} />
      <IntentComposerHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function IntentComposerHelpModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-xl p-6 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="border-border/40 border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-base font-extrabold tracking-tight">
                Executive Directive Guide & Tips
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium">
                How plain-language goals translate into government policy packages.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4 space-y-3.5 text-xs">
          {/* Step 1 */}
          <FacetCard depth={2} className="bg-card/40 border-border/40 space-y-1 p-3.5">
            <div className="text-foreground flex items-center gap-2 text-sm font-bold">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-black text-amber-500">
                1
              </span>
              <span>Declare Intention in Plain Language</span>
            </div>
            <p className="text-muted-foreground pl-7 leading-relaxed font-medium">
              Type any executive goal like{" "}
              <code className="font-mono font-bold text-amber-500">"cool housing prices"</code>,{" "}
              <code className="font-mono font-bold text-amber-500">
                "create manufacturing jobs"
              </code>
              , or <code className="font-mono font-bold text-amber-500">"modernize defense"</code>.
              The Statecraft engine parses your executive goals into directive packages.
            </p>
          </FacetCard>

          {/* Step 2 */}
          <FacetCard depth={2} className="bg-card/40 border-border/40 space-y-1 p-3.5">
            <div className="text-foreground flex items-center gap-2 text-sm font-bold">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-black text-amber-500">
                2
              </span>
              <span>Evaluate 3 Ministry Package Tiers</span>
            </div>
            <ul className="text-muted-foreground space-y-1.5 pl-7 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-emerald-500 dark:text-emerald-400">Measured:</strong> Low
                  risk, conservative changes, broad cabinet support.
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>
                  <strong className="text-amber-500 dark:text-amber-400">Moderate:</strong> Balanced
                  approach with targeted policy levers and budget shifts.
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <span>
                  <strong className="text-red-500 dark:text-red-400">Extreme:</strong> Aggressive
                  overhaul with rapid impact but higher political risk.
                </span>
              </li>
            </ul>
          </FacetCard>

          {/* Step 3 */}
          <FacetCard depth={2} className="bg-card/40 border-border/40 space-y-1 p-3.5">
            <div className="text-foreground flex items-center gap-2 text-sm font-bold">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-black text-amber-500">
                3
              </span>
              <span>Cabinet & Power Broker Support</span>
            </div>
            <p className="text-muted-foreground pl-7 leading-relaxed font-medium">
              Check the <strong className="text-foreground">Cabinet Alignments</strong> strip across
              the top. Satisfied Power Brokers boost policy acceptance and lower civil service
              friction.
            </p>
          </FacetCard>

          {/* Pro Tips Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-500 dark:text-amber-300">
            <Command className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <div className="text-xs font-bold">Executive Pro Tip: Chaining Directives</div>
              <div className="text-muted-foreground text-[11px] leading-relaxed font-medium">
                After committing a directive, click{" "}
                <strong className="text-foreground font-bold">"Build on this →"</strong> to chain
                related follow-up directives into a multi-turn national reform initiative!
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-border/40 border-t pt-3">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full cursor-pointer bg-amber-500 font-bold text-black hover:bg-amber-600"
          >
            Got it, return to Executive Console
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
