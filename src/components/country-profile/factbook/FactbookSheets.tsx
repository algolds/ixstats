"use client";

import Link from "next/link";
import { Bank, Coins, Globe, NavArrowRight } from "iconoir-react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import {
  formatBig,
  formatPercent,
} from "~/app/countries/[slug]/_utils/profileLayer";
import {
  FactbookMetricsProvider,
  useFactbookMetrics,
} from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { FactbookModals } from "~/components/mycountry/shared/modals/FactbookModals";
import { EconomyTab, GovernmentTab, LaborTab } from "~/components/mycountry/shared/tabs";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import type { CountrySheet, EconomySegment } from "~/lib/country/country-routes";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { diplomaticMatrix } from "../derive";
import { PublicRelationsList } from "./PublicRelationsList";

const COPY: Record<
  CountrySheet,
  { title: string; description: string; icon: React.ReactNode }
> = {
  economy: {
    title: "Economy & people",
    description: "The economy and the workforce in full.",
    icon: <Coins />,
  },
  state: {
    title: "State",
    description: "Government, offices, budget and elections.",
    icon: <Bank />,
  },
  foreign: {
    title: "Foreign affairs",
    description: "Every relation and embassy.",
    icon: <Globe />,
  },
};

const SEGMENTS = [
  { value: "economy", label: "Economy" },
  { value: "labor", label: "Labor" },
] as const;

function sheetSummaryStats(
  layer: CountryProfileLayer,
  sheet: CountrySheet
): { label: string; value: string }[] {
  if (sheet === "economy") {
    const { vitals } = layer;
    return [
      { label: "GDP", value: formatBig(vitals.gdpTotal, { currency: true }) },
      { label: "Per capita", value: formatBig(vitals.gdpPerCapita, { currency: true }) },
      { label: "Population", value: formatBig(vitals.population) },
      { label: "Unemployment", value: formatPercent(vitals.unemployment, 1) },
    ];
  }
  if (sheet === "state") {
    const g = layer.state.government;
    const e = layer.state.election;
    const system = g?.type ?? layer.identity.governmentType;
    return [
      { label: "System", value: system ? stripHtml(system) : "–" },
      { label: "Legislature", value: g?.legislature ? stripHtml(g.legislature) : "–" },
      { label: "Judiciary", value: g?.judiciary ? stripHtml(g.judiciary) : "–" },
      { label: "Seats", value: e && e.totalSeats > 0 ? `${e.totalSeats}` : "–" },
    ];
  }
  const m = diplomaticMatrix(layer.world);
  return [
    { label: "Relations", value: String(m.relationCount) },
    { label: "Partners", value: String(m.partners.length) },
    { label: "Embassies", value: String(m.embassiesHosted + m.embassiesAbroad) },
    { label: "Treaties", value: String(m.treatyCount) },
  ];
}

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
            className="text-callout text-label focus-visible:outline-tint rounded-control-sm inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
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
  const stats = open ? sheetSummaryStats(layer, open.sheet) : [];
  return (
    <Sheet open={!!open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-3xl">
        {open && copy && (
          <>
            <SheetHeader className="mb-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="facet-recess text-tint rounded-control grid size-10 shrink-0 place-items-center [:where(&)_svg]:size-5"
                >
                  {copy.icon}
                </span>
                <div className="min-w-0 text-left">
                  <SheetTitle>{copy.title}</SheetTitle>
                  <SheetDescription>{copy.description}</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            {stats.length > 0 && (
              <Card padding="sm" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map((stat) => (
                  <Card key={stat.label} padding="sm" className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-caption text-label-secondary truncate">{stat.label}</span>
                    <span className="text-headline text-label truncate tabular-nums">
                      {stat.value}
                    </span>
                  </Card>
                ))}
              </Card>
            )}
            <SheetBody layer={layer} open={open} onSegment={onSegment} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
