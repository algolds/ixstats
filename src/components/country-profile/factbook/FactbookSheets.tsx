"use client";

import Link from "next/link";
import { NavArrowRight } from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  FactbookMetricsProvider,
  useFactbookMetrics,
} from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { FactbookModals } from "~/components/mycountry/shared/modals/FactbookModals";
import { EconomyTab, GovernmentTab, LaborTab } from "~/components/mycountry/shared/tabs";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import type { CountrySheet, EconomySegment } from "~/lib/country/country-routes";
import { PublicRelationsList } from "./PublicRelationsList";

const COPY: Record<CountrySheet, { title: string; description: string }> = {
  economy: { title: "Economy & people", description: "The economy and the workforce in full." },
  state: { title: "State", description: "Government, offices, budget and elections." },
  foreign: { title: "Foreign affairs", description: "Every relation and embassy." },
};

const SEGMENTS = [
  { value: "economy", label: "Economy" },
  { value: "labor", label: "Labor" },
] as const;

/** Today's Economy, Labor and Government sections, fed by the shared factbook metrics. */
function MetricsSection({ section }: { section: "economy" | "labor" | "government" }) {
  const m = useFactbookMetrics();
  if (!m.country) return null;
  const common = {
    country: m.country,
    economyData: m.economyData,
    countryImageData: m.countryImageData,
    setImageUploadModalAction: m.setImageUploadModal,
    openMetricModalAction: m.openMetricModal,
    metricView: m.metricView,
    setMetricViewAction: m.setMetricView,
  };
  if (section === "economy") return <EconomyTab {...common} />;
  if (section === "labor") return <LaborTab {...common} />;
  return <GovernmentTab {...common} governmentStructure={m.governmentStructure ?? null} />;
}

function SheetBody({
  layer,
  open,
  onSegment,
}: {
  layer: CountryProfileLayer;
  open: { sheet: CountrySheet; segment: EconomySegment };
  onSegment: (segment: EconomySegment) => void;
}) {
  if (open.sheet === "foreign") return <PublicRelationsList world={layer.world} />;
  const section = open.sheet === "state" ? "government" : open.segment;
  return (
    // The metrics (and their queries) load only while a sheet is open.
    <FactbookMetricsProvider section={section}>
      {open.sheet === "economy" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            options={SEGMENTS}
            value={open.segment}
            onValueChange={onSegment}
            aria-label="Economy and labor"
            size="sm"
          />
          <Link
            href={`/countries/${layer.slug}/modeling`}
            className="text-callout text-tint focus-visible:outline-tint rounded-control-sm inline-flex items-center gap-1 font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Model scenarios
            <NavArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}
      <MetricsSection section={section} />
      <FactbookModals />
    </FactbookMetricsProvider>
  );
}

/**
 * FactbookSheets — the Factbook blocks' full detail, one sheet at a time: Economy & people
 * (today's Economy and Labor sections as two segments, with the modeling sandbox's link), State
 * (the Government section) and Foreign affairs (every relation and embassy).
 */
export function FactbookSheets({
  layer,
  open,
  onClose,
  onSegment,
}: {
  layer: CountryProfileLayer;
  open: { sheet: CountrySheet; segment: EconomySegment } | null;
  onClose: () => void;
  onSegment: (segment: EconomySegment) => void;
}) {
  const copy = open ? COPY[open.sheet] : null;
  return (
    <Sheet open={!!open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-3xl">
        {open && copy && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>{copy.title}</SheetTitle>
              <SheetDescription>{copy.description}</SheetDescription>
            </SheetHeader>
            <SheetBody layer={layer} open={open} onSegment={onSegment} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
