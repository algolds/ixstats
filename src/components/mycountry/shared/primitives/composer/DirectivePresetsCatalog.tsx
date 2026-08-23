"use client";

import React, { useState, useMemo } from "react";
import { KeyCommand as Command, DiceSix as Dices, Search, Label as Tag, Sparks as Sparkles, Check } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface DomesticSuggestion {
  category: string;
  label: string;
  keywords: string[];
  icon: string;
}

export const DOMESTIC_SUGGESTIONS: DomesticSuggestion[] = [
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
    label: "Tame high consumer price inflation",
    keywords: ["inflation", "price", "cost", "consumer"],
    icon: "📉",
  },

  // Fiscal (8 presets)
  {
    category: "Fiscal",
    label: "Reduce federal corporate income taxes",
    keywords: ["tax", "corporate", "revenue", "fiscal"],
    icon: "🏛️",
  },
  {
    category: "Fiscal",
    label: "Cut government budget deficits",
    keywords: ["deficit", "budget", "spend", "debt"],
    icon: "✂️",
  },
  {
    category: "Fiscal",
    label: "Implement luxury wealth surtax",
    keywords: ["tax", "wealth", "luxury", "income"],
    icon: "💎",
  },
  {
    category: "Fiscal",
    label: "Increase infrastructure capital spending",
    keywords: ["spend", "infrastructure", "budget", "capital"],
    icon: "🏗️",
  },
  {
    category: "Fiscal",
    label: "Pay down national sovereign debt",
    keywords: ["debt", "sovereign", "treasury", "pay"],
    icon: "📜",
  },
  {
    category: "Fiscal",
    label: "Streamline government procurement spend",
    keywords: ["waste", "spend", "procurement", "efficiency"],
    icon: "⚙️",
  },
  {
    category: "Fiscal",
    label: "Establish national sovereign wealth fund",
    keywords: ["fund", "sovereign", "reserve", "wealth"],
    icon: "🏛️",
  },
  {
    category: "Fiscal",
    label: "Simplify personal income tax brackets",
    keywords: ["tax", "bracket", "income", "personal"],
    icon: "📋",
  },

  // Social (8 presets)
  {
    category: "Social",
    label: "Expand national healthcare coverage",
    keywords: ["health", "hospital", "doctor", "medical"],
    icon: "🏥",
  },
  {
    category: "Social",
    label: "Increase public education funding",
    keywords: ["school", "education", "teacher", "student"],
    icon: "📚",
  },
  {
    category: "Social",
    label: "Strengthen social safety net pensions",
    keywords: ["pension", "welfare", "safety", "senior"],
    icon: "🛡️",
  },
  {
    category: "Social",
    label: "Subsidize childcare and parental leave",
    keywords: ["child", "family", "parental", "leave"],
    icon: "👶",
  },
  {
    category: "Social",
    label: "Build affordable public housing complexes",
    keywords: ["housing", "public", "shelter", "community"],
    icon: "🏢",
  },
  {
    category: "Social",
    label: "Fund national mental health initiatives",
    keywords: ["mental", "health", "care", "wellness"],
    icon: "🧠",
  },
  {
    category: "Social",
    label: "Support Indigenous community cultural programs",
    keywords: ["indigenous", "culture", "community", "heritage"],
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
    label: "Upgrade emergency response dispatch systems",
    keywords: ["emergency", "fire", "dispatch", "rescue"],
    icon: "🚒",
  },

  // Defense (8 presets)
  {
    category: "Defense",
    label: "Boost military defense readiness",
    keywords: ["military", "defense", "army", "troops", "readiness"],
    icon: "🎖️",
  },
  {
    category: "Defense",
    label: "Modernize naval fleet defense capability",
    keywords: ["navy", "ship", "fleet", "sea"],
    icon: "🚢",
  },
  {
    category: "Defense",
    label: "Upgrade air force fighter squadron equipment",
    keywords: ["air", "jet", "fighter", "aircraft"],
    icon: "🛩️",
  },
  {
    category: "Defense",
    label: "Expand military R&D defense technology",
    keywords: ["tech", "research", "defense", "weaponry"],
    icon: "🔬",
  },
  {
    category: "Defense",
    label: "Increase defense personnel salary and benefits",
    keywords: ["pay", "salary", "soldier", "benefit"],
    icon: "🎗️",
  },
  {
    category: "Defense",
    label: "Fortify coastal coastal defense artillery",
    keywords: ["coastal", "fortify", "bunker", "artillery"],
    icon: "🏰",
  },
  {
    category: "Defense",
    label: "Conduct joint allied military exercises",
    keywords: ["exercise", "ally", "joint", "drill"],
    icon: "🌐",
  },
  {
    category: "Defense",
    label: "Establish space force satellite defense unit",
    keywords: ["space", "satellite", "orbit", "intel"],
    icon: "🛰️",
  },

  // Diplomacy (8 presets)
  {
    category: "Diplomacy",
    label: "Sign bilateral free trade agreement",
    keywords: ["trade", "pact", "agreement", "treaty", "ally"],
    icon: "🤝",
  },
  {
    category: "Diplomacy",
    label: "Expand international embassy footprint",
    keywords: ["embassy", "diplomat", "consulate", "foreign"],
    icon: "🏛️",
  },
  {
    category: "Diplomacy",
    label: "Join regional economic trade coalition",
    keywords: ["coalition", "alliance", "trade", "pact"],
    icon: "🌐",
  },
  {
    category: "Diplomacy",
    label: "Broker regional peace treaty mediation",
    keywords: ["peace", "treaty", "mediation", "truce"],
    icon: "🕊️",
  },
  {
    category: "Diplomacy",
    label: "Negotiate mutual visa-free travel pacts",
    keywords: ["visa", "travel", "border", "passport"],
    icon: "🛂",
  },
  {
    category: "Diplomacy",
    label: "Provide international foreign humanitarian aid",
    keywords: ["aid", "relief", "humanitarian", "global"],
    icon: "❤️",
  },
  {
    category: "Diplomacy",
    label: "Host global environmental climate summit",
    keywords: ["summit", "climate", "global", "conference"],
    icon: "🌍",
  },
  {
    category: "Diplomacy",
    label: "Apply for international trade organization seat",
    keywords: ["seat", "member", "organization", "global"],
    icon: "🏛️",
  },

  // Governance (8 presets)
  {
    category: "Governance",
    label: "Pass government transparency ethics reform",
    keywords: ["reform", "ethics", "transparency", "anti-corruption"],
    icon: "📜",
  },
  {
    category: "Governance",
    label: "Digitalize government civil service e-portal",
    keywords: ["digital", "e-government", "service", "portal"],
    icon: "💻",
  },
  {
    category: "Governance",
    label: "Devolve administrative powers to regional states",
    keywords: ["devolve", "regional", "state", "federal"],
    icon: "🗺️",
  },
  {
    category: "Governance",
    label: "Enforce strict campaign finance disclosure laws",
    keywords: ["election", "campaign", "finance", "donor"],
    icon: "🗳️",
  },
  {
    category: "Governance",
    label: "Audit public civil service efficiency department",
    keywords: ["audit", "efficiency", "civil", "service"],
    icon: "🔍",
  },
  {
    category: "Governance",
    label: "Establish national independent ethics commission",
    keywords: ["ethics", "commission", "oversight", "integrity"],
    icon: "⚖️",
  },
  {
    category: "Governance",
    label: "Modernize civil registration national identity records",
    keywords: ["id", "identity", "record", "civil"],
    icon: "🆔",
  },
  {
    category: "Governance",
    label: "Improve parliamentary legislative committee throughput",
    keywords: ["parliament", "committee", "bill", "law"],
    icon: "🏛️",
  },
];

export const CATEGORIES = [
  "All",
  "Economy",
  "Fiscal",
  "Social",
  "Infrastructure",
  "Security",
  "Defense",
  "Diplomacy",
  "Governance",
] as const;

export interface DirectivePresetsCatalogProps {
  activeGoal?: string;
  searchQuery?: string;
  onSelectGoal: (goal: string) => void;
  onSurpriseMe?: () => void;
}

export const DirectivePresetsCatalog = React.memo(function DirectivePresetsCatalog({
  activeGoal,
  searchQuery = "",
  onSelectGoal,
  onSurpriseMe,
}: DirectivePresetsCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const filteredPresets = useMemo(() => {
    return DOMESTIC_SUGGESTIONS.filter((item) => {
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchCat;
      const matchLabel = item.label.toLowerCase().includes(q);
      const matchKeyword = item.keywords.some((k) => k.toLowerCase().includes(q));
      return matchCat && (matchLabel || matchKeyword);
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Category Pill Tabs */}
      <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-[11px] font-extrabold transition-all duration-150 select-none active:scale-95",
                selectedCategory === cat
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-950 shadow-sm dark:text-amber-300"
                  : "border-border/40 bg-card/40 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {onSurpriseMe && (
          <button
            type="button"
            onClick={onSurpriseMe}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-800 transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Surprise Me</span>
          </button>
        )}
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPresets.map((item, idx) => {
          const isSelected = activeGoal === item.label;
          return (
            <button
              key={`${item.category}-${idx}`}
              type="button"
              onClick={() => onSelectGoal(item.label)}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-150 active:scale-[0.98]",
                isSelected
                  ? "border-amber-500 bg-amber-500/15 shadow-md ring-2 ring-amber-500/40"
                  : "border-border/50 bg-card/60 hover:bg-card hover:border-amber-500/40 hover:shadow-sm"
              )}
            >
              <span className="bg-muted/40 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg shadow-xs">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs leading-snug font-bold transition-colors",
                    isSelected
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400"
                  )}
                >
                  {item.label}
                </p>
                <span className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase opacity-80">
                  {item.category}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-amber-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
});
