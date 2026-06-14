"use client";

import Link from "next/link";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Brain, Shield, Crown, Users, Map, Vote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";

interface MyCountryNavCardsProps {
  currentPage?:
    | "overview"
    | "executive"
    | "intelligence"
    | "defense"
    | "diplomacy"
    | "politics"
    | "map-editor";
  collapsed?: boolean;
}

export function MyCountryNavCards({ currentPage, collapsed = false }: MyCountryNavCardsProps) {
  const cards = [
    {
      id: "overview" as const,
      href: "/mycountry",
      icon: Crown,
      title: "Overview",
      description: "Dashboard",
      gradient: SECTION_THEME_CLASSES.overview.gradient,
    },
    {
      id: "executive" as const,
      href: "/mycountry/executive",
      icon: Crown,
      title: "Executive",
      description: "Command",
      gradient: SECTION_THEME_CLASSES.executive.gradient,
    },
    {
      id: "diplomacy" as const,
      href: "/mycountry/diplomacy",
      icon: Users,
      title: "Diplomacy",
      description: "Relations",
      gradient: SECTION_THEME_CLASSES.diplomacy.gradient,
    },
    {
      id: "intelligence" as const,
      href: "/mycountry/intelligence",
      icon: Brain,
      title: "Intelligence",
      description: "Analytics",
      gradient: SECTION_THEME_CLASSES.intelligence.gradient,
    },
    {
      id: "defense" as const,
      href: "/mycountry/defense",
      icon: Shield,
      title: "Defense",
      description: "Security",
      gradient: SECTION_THEME_CLASSES.defense.gradient,
    },
    {
      id: "politics" as const,
      href: "/mycountry/politics",
      icon: Vote,
      title: "Politics",
      description: "Legislature",
      gradient: SECTION_THEME_CLASSES.politics.gradient,
    },
  ];

  // Filter out current page
  const visibleCards = cards.filter((card) => card.id !== currentPage);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex items-center gap-2 transition-all duration-500 ease-in-out",
          collapsed
            ? "pointer-events-none max-h-0 scale-95 overflow-hidden opacity-0"
            : "max-h-[60px] scale-100 opacity-100"
        )}
        style={{ willChange: "transform, opacity" }}
      >
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Tooltip key={card.id}>
              <TooltipTrigger asChild>
                <Link
                  href={card.href}
                  className={cn(
                    "group relative rounded-full p-3",
                    "bg-gradient-to-br",
                    card.gradient,
                    "transition-all duration-200",
                    "hover:scale-110 hover:shadow-lg hover:shadow-black/20",
                    "active:scale-95",
                    "focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:outline-none",
                    "min-h-[48px] min-w-[48px]",
                    "flex items-center justify-center"
                  )}
                  aria-label={`Go to ${card.title}`}
                >
                  <Icon className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="">
                <div className="text-center">
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="text-muted-foreground text-xs">{card.description}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
