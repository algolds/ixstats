"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { getStandingBand } from "~/lib/diplomacy/relation-bands";
import { calculateRelativeDevelopment } from "~/lib/diplomacy/relative-development";

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

interface EmbassyCardProps {
  embassy: EmbassySummary;
  /** Whether the current user owns this country */
  isOwner: boolean;
  /** Callback when card is clicked */
  onClick: () => void;
}

/** One embassy row: compact paired flags, partner pair, and relationship standing. */
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
    <div
      role={isOwner ? "button" : undefined}
      tabIndex={isOwner ? 0 : undefined}
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
      className={cn(
        "space-y-3 p-4 text-left transition-colors",
        isOwner && "hover:bg-fill-4 cursor-pointer active:scale-[0.995]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center -space-x-1.5">
            {[
              { name: embassy.guestCountry, flag: embassy.guestCountryFlag },
              { name: embassy.hostCountry, flag: embassy.hostCountryFlag },
            ].map((side) => (
              <div
                key={side.name}
                className="border-separator bg-surface rounded-control-sm overflow-hidden border"
              >
                <UnifiedCountryFlag
                  countryName={side.name}
                  flagUrl={side.flag}
                  size="sm"
                  showPlaceholder={true}
                  rounded={false}
                />
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <h3 className="text-label text-headline truncate">{embassy.name}</h3>
            <p className="text-label-secondary text-footnote mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>
                {embassy.guestCountry} ⟷ {embassy.hostCountry}
              </span>
              <span aria-hidden>·</span>
              <span className="capitalize">{embassy.status.toLowerCase()}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {asymmetry && (
            <Badge variant="outline" className="text-label-secondary">
              {asymmetry.label}
            </Badge>
          )}
          {isOwner && <ChevronRight className="text-label-tertiary h-4 w-4" aria-hidden="true" />}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Relationship standing</span>
          <span className={cn("font-medium", standing?.textClass ?? "text-label-secondary")}>
            {standing?.label ?? "Not yet rated"}
          </span>
        </div>
        <Progress
          value={embassy.strength ?? 0}
          className="h-1.5"
          indicatorClassName={standing?.barClass}
        />
      </div>
    </div>
  );
});
