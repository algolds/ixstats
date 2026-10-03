"use client";

import React, { memo } from "react";
import Link from "next/link";
import {
  PathArrow as RouteIcon,
  Dashboard as Gauge,
  Clock,
  Train,
  Car,
  DeliveryTruck as Ship,
  Airplane as Plane,
  ArrowUpRight,
  Shield,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface TransitMobilityCardProps {
  countryId: string;
  countryName?: string;
}

const MODAL_ICONS: Record<string, typeof Train> = {
  high_speed_rail: Train,
  rail: Train,
  freight_rail: Train,
  commuter_rail: Train,
  motorway: Car,
  highway: Car,
  trunk: Car,
  road: Car,
  shipping_lane: Ship,
  canal: Ship,
  ferry: Ship,
  air_corridor: Plane,
};

/** TAMI rating → semantic status colour (only the dot and score carry it). */
const RATING_THEMES = {
  world_class: { text: "text-green", dot: "bg-green" },
  advanced: { text: "text-label", dot: "bg-label-tertiary" },
  developing: { text: "text-orange", dot: "bg-orange" },
  underdeveloped: { text: "text-destructive", dot: "bg-destructive" },
} as const;

const CONDITION_TEXT_THEMES = {
  optimal: "text-green",
  adequate: "text-label",
  deteriorating: "text-orange",
  failing: "text-destructive",
} as const;

function MapEditorLink({ label }: { label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="h-11 shrink-0 sm:h-8">
      <Link href="/mycountry/editor">
        {label}
        <ArrowUpRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

/** A headline figure inside the transit card (opaque: nested in a Facet card). */
function TransitStat({
  label,
  icon: Icon,
  children,
  footer,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col justify-between p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />}
        <Eyebrow>{label}</Eyebrow>
      </div>
      <div className="my-2 flex items-baseline gap-2">{children}</div>
      <div className="text-footnote flex items-center justify-between gap-2">{footer}</div>
    </Card>
  );
}

export const TransitMobilityCard = memo(function TransitMobilityCard({
  countryId,
  countryName: _countryName,
}: TransitMobilityCardProps) {
  const { data: profile, isLoading } = api.transport.getNationalMobilityProfile.useQuery(
    { countryId },
    { staleTime: 30_000, enabled: !!countryId }
  );

  if (isLoading) {
    return <Skeleton className="rounded-card h-48" aria-label="Loading transit profile" />;
  }

  if (!profile || profile.totalOperationalKm === 0) {
    return (
      <Card className="rounded-card">
        <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <RouteIcon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
            <h3 className="text-label text-headline">National transit and mobility</h3>
          </div>
          <MapEditorLink label="Open map editor" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-label-secondary text-footnote leading-relaxed">
            No transport routes are mapped. Build highways, railways or shipping lanes in the map
            editor to connect the country and raise GDP.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { tami, degradation, modalSummary, topCorridors, totalOperationalKm } = profile;
  const ratingTheme = RATING_THEMES[tami.rating] ?? RATING_THEMES.underdeveloped;
  const conditionTextClass =
    CONDITION_TEXT_THEMES[degradation.condition] ?? CONDITION_TEXT_THEMES.adequate;

  return (
    <Card className="rounded-card">
      {/* Header */}
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <RouteIcon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-label text-headline">Transit accessibility and mobility (TAMI)</h3>
            <p className="text-label-secondary text-footnote">
              Spatial velocity and intercity transit efficiency
            </p>
          </div>
        </div>
        <MapEditorLink label="Map editor transit" />
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-4">
        {/* TAMI score + core metrics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TransitStat
            label="Mobility score"
            footer={
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", ratingTheme.dot)} />
                <span className="text-label font-medium">{tami.ratingLabel}</span>
              </span>
            }
          >
            <span className={cn("text-large-title tabular-nums", ratingTheme.text)}>
              {tami.tamiScore}
            </span>
            <span className="text-label-secondary text-footnote">/ 100</span>
          </TransitStat>

          <TransitStat
            label="Average network speed"
            icon={Gauge}
            footer={
              <>
                <span className="text-label-secondary">Total network</span>
                <span className="text-label font-medium tabular-nums">
                  {totalOperationalKm.toLocaleString()} km
                </span>
              </>
            }
          >
            <span className="text-label text-large-title tabular-nums">
              {modalSummary.overallWeightedSpeedKmh}
            </span>
            <span className="text-label-secondary text-footnote">km/h</span>
          </TransitStat>

          <TransitStat
            label="Maintenance health"
            icon={Shield}
            footer={
              <>
                <span className="text-label-secondary">Condition</span>
                <span className={cn("font-medium capitalize", conditionTextClass)}>
                  {degradation.conditionLabel}
                </span>
              </>
            }
          >
            <span className={cn("text-large-title tabular-nums", conditionTextClass)}>
              {(degradation.speedDegradationFactor * 100).toFixed(0)}%
            </span>
            <span className="text-label-secondary text-footnote">speed retention</span>
          </TransitStat>
        </div>

        {/* Modal velocities */}
        {Object.keys(modalSummary.modalGroups).length > 0 && (
          <div className="space-y-2">
            <Eyebrow className="block">Modal velocities and network extent</Eyebrow>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(modalSummary.modalGroups).map(([key, group]) => {
                const Icon = MODAL_ICONS[key] ?? RouteIcon;
                return (
                  <Card
                    variant="inset"
                    key={key}
                    className="text-footnote flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {/* Route-type colour from the map legend (data, not decoration) */}
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <Icon
                        aria-hidden="true"
                        className="text-label-secondary h-3.5 w-3.5 shrink-0"
                      />
                      <span className="text-label truncate font-medium">{group.label}</span>
                    </div>
                    <span className="text-label shrink-0 font-medium tabular-nums">
                      {group.avgSpeedKmh} <span className="text-label-secondary">km/h</span>
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Top travel corridors */}
        {topCorridors.length > 0 && (
          <div className="space-y-2">
            <Eyebrow className="block">Primary intercity travel corridors</Eyebrow>
            <Card variant="inset" padding="none" className="max-h-48 overflow-y-auto">
              <ul className="divide-separator divide-y">
                {topCorridors.map((c) => (
                  <li
                    key={c.id}
                    className="text-footnote flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-label truncate font-medium">{c.name}</div>
                      <div className="text-label-secondary flex items-center gap-2">
                        <span className="capitalize">{c.routeType.replace("_", " ")}</span>
                        <span className="tabular-nums">· {c.lengthKm} km</span>
                        <span className="tabular-nums">· {c.effectiveSpeedKmh} km/h</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Clock aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                      <span className="text-label font-semibold tabular-nums">
                        {c.formattedTravelTime}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
