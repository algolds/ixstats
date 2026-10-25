"use client";

import React from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { City as Building2, NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { getStandingBand } from "~/lib/diplomacy/relation-bands";
import { calculateRelativeDevelopment } from "~/lib/diplomacy/relative-development";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** An embassy as the network grid shows it. */
export interface EmbassySummary {
  id: string;
  name: string;
  hostCountry: string;
  hostCountryFlag?: string | null;
  guestCountry: string;
  guestCountryFlag?: string | null;
  status: string;
  /** The pair's relation strength (0-100), null when they have no relation record yet. */
  strength: number | null;
  /** Economic tiers for the asymmetry badge; the badge is hidden when either is unknown. */
  hostCountryTier?: string | null;
  guestCountryTier?: string | null;
  /** The viewed country's side of the embassy, which sets the badge's point of view. */
  role?: "host" | "guest";
}

/**
 * Props for EmbassyCard component
 */
interface EmbassyCardProps {
  embassy: EmbassySummary;
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Callback when card is clicked */
  onClick: () => void;
}

/** One embassy: paired flags, the partner pair, and the pair's relationship standing. */
export const EmbassyCard = React.memo(function EmbassyCard({
  embassy,
  isOwner,
  onClick,
}: EmbassyCardProps) {
  const asymmetry = React.useMemo(() => {
    const viewedIsHost = embassy.role === "host";
    return calculateRelativeDevelopment(
      viewedIsHost ? embassy.hostCountryTier : embassy.guestCountryTier,
      viewedIsHost ? embassy.guestCountryTier : embassy.hostCountryTier
    );
  }, [embassy.role, embassy.hostCountryTier, embassy.guestCountryTier]);

  const standing = embassy.strength === null ? null : getStandingBand(embassy.strength);

  return (
    <Card
      className="rounded-card overflow-hidden"
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
      interactive
    >
      {/* Paired flag header: host left, guest right */}
      <div className="border-separator relative flex h-20 overflow-hidden border-b">
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
          <div className="bg-surface border-separator shadow-card rounded-full border p-2">
            <Building2 className="text-label h-4 w-4" />
          </div>
        </div>
      </div>

      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-label text-title-3 truncate">{embassy.name}</h3>
            <p className="text-label-secondary text-footnote mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                {embassy.guestCountry} ⟷ {embassy.hostCountry}
              </span>
              <span aria-hidden>·</span>
              <span className="capitalize">{embassy.status}</span>
            </p>
          </div>
          {asymmetry && (
            <Badge variant="outline" className="text-label-secondary shrink-0">
              {asymmetry.label}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <div className="space-y-2">
          <div className="text-footnote flex items-center justify-between">
            <Eyebrow>Relationship standing</Eyebrow>
            <span className={cn("font-semibold", standing?.textClass ?? "text-label-secondary")}>
              {standing?.label ?? "Not yet rated"}
            </span>
          </div>
          <Progress
            value={embassy.strength ?? 0}
            className="h-2"
            indicatorClassName={standing?.barClass}
          />
        </div>

        {isOwner && (
          <div className="border-separator space-y-2 border-t pt-3">
            <p className="text-label-secondary text-footnote flex items-center justify-center gap-1">
              Open for embassy details
              <ChevronRight className="h-3 w-3" />
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
