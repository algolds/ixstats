"use client";

import Link from "next/link";
import { Command, Brain, Shield, Crown, Users, Map } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface MyCountryNavCardsProps {
  currentPage?: "overview" | "executive" | "intelligence" | "defense" | "diplomacy" | "map-editor";
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
      gradient: "from-amber-500 to-yellow-500",
    },
    {
      id: "executive" as const,
      href: "/mycountry/executive",
      icon: Crown,
      title: "Executive",
      description: "Command",
      gradient: "from-amber-500 to-yellow-500",
    },
    {
      id: "diplomacy" as const,
      href: "/mycountry/diplomacy",
      icon: Users,
      title: "Diplomacy",
      description: "Relations",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      id: "intelligence" as const,
      href: "/mycountry/intelligence",
      icon: Brain,
      title: "Intelligence",
      description: "Analytics",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      id: "defense" as const,
      href: "/mycountry/defense",
      icon: Shield,
      title: "Defense",
      description: "Security",
      gradient: "from-red-500 to-orange-500",
    },
    {
      id: "map-editor" as const,
      href: "/mycountry/map-editor",
      icon: Map,
      title: "Map Editor",
      description: "Territory",
      gradient: "from-emerald-500 to-teal-500",
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
            ? "opacity-0 max-h-0 overflow-hidden scale-95 pointer-events-none"
            : "opacity-100 max-h-[60px] scale-100"
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
                    "focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2",
                    "min-w-[48px] min-h-[48px]",
                    "flex items-center justify-center"
                  )}
                  aria-label={`Go to ${card.title}`}
                >
                  <Icon className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                className="glass-hierarchy-child"
              >
                <div className="text-center">
                  <p className="font-semibold text-sm">{card.title}</p>
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
