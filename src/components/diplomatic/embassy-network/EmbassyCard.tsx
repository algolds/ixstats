"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Building2, ShieldCheck, ChevronRight, CreditCard } from "lucide-react";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import Link from "next/link";
import { getStandingBand, getSynergyBand } from "~/lib/diplomacy/relation-bands";
import { calculateRelativeDevelopment } from "~/lib/diplomacy/relative-development";

/**
 * Embassy data with calculated synergies
 */
interface EmbassyWithSynergies {
  id: string;
  name: string;
  hostCountry: string;
  hostCountryFlag?: string | null;
  guestCountry: string;
  guestCountryFlag?: string | null;
  status: string;
  strength: number;
  totalSynergyScore: number;
  economicBonus: number;
  diplomaticBonus: number;
  culturalBonus: number;
  synergies: Array<{
    category: string;
    matchScore: number;
    sharedComponents: string[];
    benefits: {
      economic: number;
      diplomatic: number;
      cultural: number;
    };
  }>;
}

/**
 * Props for EmbassyCard component
 */
interface EmbassyCardProps {
  /** Embassy data with calculated synergies */
  embassy: EmbassyWithSynergies;
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Callback when card is clicked */
  onClick: () => void;
}

/**
 * EmbassyCard Component
 *
 * Displays an individual embassy with blended flag header, synergy metrics,
 * and benefit breakdown across economic, diplomatic, and cultural dimensions.
 *
 * Features:
 * - Blended flag header with visual divider
 * - Embassy details (name, countries, status, strength)
 * - Synergy badge and progress bar
 * - Benefits grid with color-coded bonuses
 * - Click hint for owners
 * - Hover effects for interactive states
 *
 * @example
 * ```tsx
 * <EmbassyCard
 *   embassy={embassyData}
 *   isOwner={true}
 *   onClick={() => setShowSharedData(embassy.id)}
 * />
 * ```
 */
export const EmbassyCard = React.memo(function EmbassyCard({
  embassy,
  isOwner,
  onClick,
}: EmbassyCardProps) {
  const asymmetry = React.useMemo(() => {
    return calculateRelativeDevelopment(
      (embassy as any).guestCountryTier || "DEVELOPED",
      (embassy as any).hostCountryTier || "DEVELOPED"
    );
  }, [embassy]);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        isOwner && "hover:ring-primary/50 cursor-pointer hover:shadow-lg hover:ring-2"
      )}
      onClick={onClick}
    >
      {/* Blended Flag Header */}
      <div className="relative h-24 overflow-hidden">
        {/* Flag blend effect */}
        <div className="absolute inset-0 flex">
          {/* Host country flag (left half) */}
          <div className="relative w-1/2 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <UnifiedCountryFlag
                countryName={embassy.hostCountry}
                flagUrl={embassy.hostCountryFlag}
                size="xl"
                className="h-full w-full object-cover"
                showPlaceholder={true}
                rounded={false}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
          </div>

          {/* Guest country flag (right half) */}
          <div className="relative w-1/2 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <UnifiedCountryFlag
                countryName={embassy.guestCountry}
                flagUrl={embassy.guestCountryFlag}
                size="xl"
                className="h-full w-full object-cover"
                showPlaceholder={true}
                rounded={false}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
          </div>
        </div>

        {/* Center divider with icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/90 border-primary/50 rounded-full border-2 p-2 shadow-lg backdrop-blur-sm">
            <Building2 className="text-primary h-5 w-5" />
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="to-background/80 absolute inset-0 bg-gradient-to-b from-transparent via-transparent" />
      </div>

      {/* Embassy Details */}
      <CardHeader className="pt-2 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">{embassy.name}</CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground/60">
                {embassy.guestCountry} ⟷ {embassy.hostCountry}
              </span>
              <span>•</span>
              <span className="capitalize">{embassy.status}</span>
              <span>•</span>
              <span>Standing: {getStandingBand(embassy.strength).label}</span>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              className={cn(
                "border font-bold shadow-sm",
                getSynergyBand(embassy.totalSynergyScore).badgeClass
              )}
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              {getSynergyBand(embassy.totalSynergyScore).label} Synergy
            </Badge>
            <Badge
              className={cn(
                "border text-[10px] font-semibold tracking-wider uppercase shadow-xs",
                asymmetry.badgeColor
              )}
            >
              {asymmetry.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Synergy Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Standing Tier</span>
            <span className={cn("font-bold", getSynergyBand(embassy.totalSynergyScore).textClass)}>
              {getSynergyBand(embassy.totalSynergyScore).label}
            </span>
          </div>
          <Progress value={embassy.totalSynergyScore} className="h-2" />
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-green-500/10 p-2 text-center">
            <div className="font-bold text-green-600 dark:text-green-400">
              {embassy.economicBonus > 0 ? "High" : "Standard"}
            </div>
            <div className="text-muted-foreground">Economic</div>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-2 text-center">
            <div className="font-bold text-blue-600 dark:text-blue-400">
              {embassy.diplomaticBonus > 0 ? "High" : "Standard"}
            </div>
            <div className="text-muted-foreground">Diplomatic</div>
          </div>
          <div className="rounded-lg bg-purple-500/10 p-2 text-center">
            <div className="font-bold text-purple-600 dark:text-purple-400">
              {embassy.culturalBonus > 0 ? "High" : "Standard"}
            </div>
            <div className="text-muted-foreground">Cultural</div>
          </div>
        </div>

        {/* Quick Actions (owners only) */}
        {isOwner && (
          <div className="space-y-2 border-t pt-3">
            <Link
              href={`/vault/market?nation=${encodeURIComponent(embassy.hostCountry)}`}
              onClick={(e) => e.stopPropagation()}
              className="block"
            >
              <Button variant="outline" size="sm" className="w-full">
                <CreditCard className="mr-2 h-3.5 w-3.5" />
                Trade Cards with {embassy.hostCountry}
              </Button>
            </Link>
            <div className="text-muted-foreground text-center text-xs">
              <span className="flex items-center justify-center gap-1">
                Click card for embassy details
                <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
