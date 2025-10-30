"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Building2, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";

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
  onClick
}: EmbassyCardProps) {
  return (
    <Card
      className={cn(
        "transition-all overflow-hidden",
        isOwner && "cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-primary/50"
      )}
      onClick={onClick}
    >
      {/* Blended Flag Header */}
      <div className="relative h-24 overflow-hidden">
        {/* Flag blend effect */}
        <div className="absolute inset-0 flex">
          {/* Host country flag (left half) */}
          <div className="w-1/2 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <UnifiedCountryFlag
                countryName={embassy.hostCountry}
                flagUrl={embassy.hostCountryFlag}
                size="xl"
                className="w-full h-full object-cover"
                showPlaceholder={true}
                rounded={false}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
          </div>

          {/* Guest country flag (right half) */}
          <div className="w-1/2 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <UnifiedCountryFlag
                countryName={embassy.guestCountry}
                flagUrl={embassy.guestCountryFlag}
                size="xl"
                className="w-full h-full object-cover"
                showPlaceholder={true}
                rounded={false}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
          </div>
        </div>

        {/* Center divider with icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/90 backdrop-blur-sm border-2 border-primary/50 rounded-full p-2 shadow-lg">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      </div>

      {/* Embassy Details */}
      <CardHeader className="pb-3 pt-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {embassy.name}
            </CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-2">
              <span className="text-muted-foreground/60">
                {embassy.guestCountry} ⟷ {embassy.hostCountry}
              </span>
              <span>•</span>
              <span className="capitalize">{embassy.status}</span>
              <span>•</span>
              <span>Strength {embassy.strength}/100</span>
            </CardDescription>
          </div>
          <Badge variant={embassy.totalSynergyScore > 50 ? "default" : "secondary"}>
            <Sparkles className="h-3 w-3 mr-1" />
            {embassy.totalSynergyScore.toFixed(0)}% Synergy
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Synergy Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Synergy Strength</span>
            <span className="font-semibold">{embassy.totalSynergyScore.toFixed(0)}%</span>
          </div>
          <Progress value={embassy.totalSynergyScore} className="h-2" />
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 rounded-lg p-2 text-center">
            <div className="text-green-600 dark:text-green-400 font-bold">
              +{embassy.economicBonus.toFixed(1)}%
            </div>
            <div className="text-muted-foreground">Economic</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2 text-center">
            <div className="text-blue-600 dark:text-blue-400 font-bold">
              +{embassy.diplomaticBonus.toFixed(1)}%
            </div>
            <div className="text-muted-foreground">Diplomatic</div>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-2 text-center">
            <div className="text-purple-600 dark:text-purple-400 font-bold">
              +{embassy.culturalBonus.toFixed(1)}%
            </div>
            <div className="text-muted-foreground">Cultural</div>
          </div>
        </div>

        {/* Click to view hint (owners only) */}
        {isOwner && (
          <div className="text-xs text-center text-muted-foreground py-2 border-t">
            <span className="flex items-center justify-center gap-1">
              Click to view embassy details
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
