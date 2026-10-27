"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { Card } from "~/components/ui/card";
import { FlagWatermark } from "~/components/ui/facet/identity/FlagWatermark";
import { createVitalityRingsFromCountry } from "~/components/mycountry/primitives";
import { VitalityBreakdownModal } from "~/components/mycountry/shared/modals/VitalityBreakdownModal";
import { GdpDetailsModal } from "~/components/mycountry/shared/modals/metric-details/GdpDetailsModal";
import { PopulationDetailsModal } from "~/components/mycountry/shared/modals/metric-details/PopulationDetailsModal";
import { GovernmentSpendingModal } from "~/components/mycountry/shared/modals/metric-details/GovernmentSpendingModal";
import {
  HeroSnapshotPanels,
  heroRings,
  type HeroModal,
  type HeroRing,
  type HeroSnapshotData,
} from "./HeroSnapshotPanels";

const DETAIL_MODALS = {
  gdp: GdpDetailsModal,
  population: PopulationDetailsModal,
  government: GovernmentSpendingModal,
};

const VITALITY_KEYS = [
  "economicVitality",
  "populationWellbeing",
  "diplomaticStanding",
  "governmentalEfficiency",
] as const;

interface CountryHeroCardProps {
  countryId: string;
  countryName: string;
  /** The flag behind the card as a watermark. */
  flagUrl: string | null;
  /** The wide leading slot: the live map on the dashboard, the cover photo on the country page. */
  media: React.ReactNode;
  /** The country's identity at the top of the panel. */
  identity: React.ReactNode;
  /** One action beside the identity (the dashboard's MyCountry button). */
  action?: React.ReactNode;
  /** A row above the card's content (the dashboard's collapse button). */
  topBar?: React.ReactNode;
  /** Decoration over the whole card (the owner's neon frame on the dashboard). */
  overlay?: React.ReactNode;
  stats: HeroSnapshotData["stats"];
  /** Vitality scores to fall back on while the ring query has none (the country record). */
  vitalityFallback?: Partial<Record<(typeof VITALITY_KEYS)[number], number | null>>;
  /**
   * A full-width row under the media and panel. When given, the rings leave the panel for it:
   * it receives them and a way to open the vitality breakdown.
   */
  footer?: (ctx: { rings: HeroRing[]; openVitality: () => void }) => React.ReactNode;
  /** Inside a larger document card (the country page): no card of its own, so no glass on glass. */
  frameless?: boolean;
}

/**
 * CountryHeroCard — the country hero shared by the dashboard and the country page: a wide media
 * slot beside an identity panel whose figures (population, GDP, standing, approval, stability)
 * open their detail sheets, with the vitality rings in the panel or in a footer row. Every figure
 * and sheet reads public data, so visitors get the same card as the owner.
 */
export function CountryHeroCard({
  countryId,
  countryName,
  flagUrl,
  media,
  identity,
  action,
  topBar,
  overlay,
  stats,
  vitalityFallback,
  footer,
  frameless = false,
}: CountryHeroCardProps) {
  const [activeModal, setActiveModal] = useState<HeroModal | null>(null);
  const { data: activity } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const ringData = activity ?? undefined;
  const rings = heroRings(ringData);
  const DetailModal = activeModal && activeModal !== "vitality" ? DETAIL_MODALS[activeModal] : null;
  const openVitality = () => setActiveModal("vitality");
  const Frame = frameless ? "div" : Card;

  return (
    <Frame className="relative overflow-hidden">
      <FlagWatermark src={flagUrl} />
      {overlay}
      {topBar && <div className="relative flex justify-end px-2 pt-1">{topBar}</div>}

      <div className={cn("relative grid gap-3 p-3 md:grid-cols-5", topBar && "pt-1")}>
        <div className="border-separator rounded-row relative h-[220px] overflow-hidden border md:col-span-3 md:h-full md:min-h-[240px]">
          {media}
        </div>

        <div className="bg-surface-secondary rounded-row shadow-card relative flex h-full flex-col gap-3 overflow-hidden p-3 md:col-span-2">
          <div className="flex items-start justify-between gap-2">
            {identity}
            {action}
          </div>
          <div className="min-h-0 flex-1">
            <HeroSnapshotPanels
              data={{ stats, activityRingsData: ringData }}
              countryId={countryId}
              showRings={!footer}
              onOpenModal={setActiveModal}
            />
          </div>
        </div>
      </div>

      {footer && (
        <div className="relative px-3 pb-3 md:px-4 md:pb-4">{footer({ rings, openVitality })}</div>
      )}

      {DetailModal && (
        <DetailModal
          isOpen
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={countryName}
        />
      )}
      {activeModal === "vitality" && (
        <VitalityBreakdownModal
          isOpen
          onClose={() => setActiveModal(null)}
          rings={createVitalityRingsFromCountry(
            Object.fromEntries(
              VITALITY_KEYS.map((key) => [key, ringData?.[key] ?? vitalityFallback?.[key]])
            )
          )}
          countryName={countryName}
        />
      )}
    </Frame>
  );
}
