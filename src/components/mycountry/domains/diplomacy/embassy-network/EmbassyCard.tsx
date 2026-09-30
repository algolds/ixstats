"use client";

import React from "react";
import { FacetCard, FacetCardHeader, FacetCardContent } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
  City as Building2,
  ShieldCheck,
  NavArrowRight as ChevronRight,
  CreditCard,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import Link from "next/link";
import { getStandingBand, getSynergyBand } from "~/lib/diplomacy/relation-bands";
import { calculateRelativeDevelopment } from "~/lib/diplomacy/relative-development";
import { useCountryData } from "~/components/mycountry/shared/primitives";

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
  /** Economic tiers for the asymmetry badge; not yet supplied by getEmbassies. */
  hostCountryTier?: string | null;
  guestCountryTier?: string | null;
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
 * - Paired flag header with a centre marker
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
  const { country } = useCountryData();
  const myName = country?.name;
  const partnerCountry =
    myName && embassy.hostCountry.toLowerCase() === myName.toLowerCase()
      ? embassy.guestCountry
      : embassy.hostCountry;

  const asymmetry = React.useMemo(() => {
    return calculateRelativeDevelopment(
      embassy.guestCountryTier || "DEVELOPED",
      embassy.hostCountryTier || "DEVELOPED"
    );
  }, [embassy]);

  const synergy = getSynergyBand(embassy.totalSynergyScore);
  const benefits = [
    { label: "Economic", high: embassy.economicBonus > 0 },
    { label: "Diplomatic", high: embassy.diplomaticBonus > 0 },
    { label: "Cultural", high: embassy.culturalBonus > 0 },
  ];

  return (
    <FacetCard
      depth={2}
      className="overflow-hidden rounded-2xl"
      onClick={isOwner ? onClick : undefined}
      onKeyDown={
        isOwner
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={isOwner ? `Open ${embassy.name}` : undefined}
    >
      {/* Paired flag header: host left, guest right */}
      <div className="border-border relative flex h-20 overflow-hidden border-b">
        {[
          { name: embassy.hostCountry, flag: embassy.hostCountryFlag },
          { name: embassy.guestCountry, flag: embassy.guestCountryFlag },
        ].map((side) => (
          <div key={side.name} className="relative w-1/2 overflow-hidden opacity-80">
            <UnifiedCountryFlag
              countryName={side.name}
              flagUrl={side.flag}
              size="xl"
              className="h-full w-full object-cover"
              showPlaceholder={true}
              rounded={false}
            />
          </div>
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background border-border rounded-full border p-2 shadow-sm">
            <Building2 className="text-foreground h-4 w-4" />
          </div>
        </div>
      </div>

      <FacetCardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground truncate text-base font-semibold">{embassy.name}</h3>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span>
                {embassy.guestCountry} ⟷ {embassy.hostCountry}
              </span>
              <span aria-hidden>·</span>
              <span className="capitalize">{embassy.status}</span>
              <span aria-hidden>·</span>
              <span>Standing: {getStandingBand(embassy.strength).label}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className={synergy.textClass}>
              <ShieldCheck />
              {synergy.label} Synergy
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {asymmetry.label}
            </Badge>
          </div>
        </div>
      </FacetCardHeader>

      <FacetCardContent className="space-y-3 px-4 pb-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Eyebrow>Standing tier</Eyebrow>
            <span className={cn("font-semibold", synergy.textClass)}>{synergy.label}</span>
          </div>
          <Progress value={embassy.totalSynergyScore} className="h-2" />
        </div>

        <dl className="grid grid-cols-3 gap-2 text-xs">
          {benefits.map((b) => (
            <div key={b.label} className="bg-muted/50 rounded-lg p-2 text-center">
              <dd
                className={cn(
                  "font-semibold",
                  b.high ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {b.high ? "High" : "Standard"}
              </dd>
              <dt className="text-muted-foreground">{b.label}</dt>
            </div>
          ))}
        </dl>

        {isOwner && (
          <div className="border-border space-y-2 border-t pt-3">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link
                href={`/vault/market?nation=${encodeURIComponent(partnerCountry)}`}
                onClick={(e) => e.stopPropagation()}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Trade Cards with {partnerCountry}
              </Link>
            </Button>
            <p className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
              Open for embassy details
              <ChevronRight className="h-3 w-3" />
            </p>
          </div>
        )}
      </FacetCardContent>
    </FacetCard>
  );
});
