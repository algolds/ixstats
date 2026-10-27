"use client";
// src/app/admin/storyteller/_components/EventImpactPreview.tsx
// Step 4 of the event wizard: the simulated impact on each affected country

import { formatCurrency } from "~/lib/utils/format-utils";
import { Badge } from "~/components/ui/badge";
import { SystemRestart as Loader2, WarningTriangle as AlertTriangle } from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function Step4Preview({
  form,
  simulation,
  isLoading,
}: {
  form: { affectedCountryIds: string[] };
  simulation:
    | {
        projectedImpacts: Array<{
          countryId: string;
          countryName: string;
          countryFlag: string | null;
          economicTier: string;
          current: { gdp: number; population: number; growthRate: number | null };
          projected: { gdpChange: number; populationChange: number; stabilityChange: number };
        }>;
        summary: {
          totalCountriesAffected: number;
          avgGdpChange: number;
          totalGdpAtRisk: number;
        };
      }
    | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-tint h-8 w-8 animate-spin" />
        <p className="text-label-secondary text-body mt-3">Simulating impact...</p>
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="text-yellow h-8 w-8" />
        <p className="text-label-secondary text-body mt-3">
          {form.affectedCountryIds.length === 0
            ? "No countries selected. Go back and select countries."
            : "Unable to generate simulation."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-label text-title-3 mb-1">Impact preview</h3>
      <p className="text-label-secondary text-body mb-4">
        Projected impact based on event severity and affected economies.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="border-separator rounded-control border p-3 text-center">
          <div className="text-label-secondary text-footnote">Countries</div>
          <div className="text-label text-title-3">{simulation.summary.totalCountriesAffected}</div>
        </div>
        <div className="border-separator rounded-control border p-3 text-center">
          <div className="text-label-secondary text-footnote">Avg GDP Change</div>
          <div
            className={`text-title-3 ${
              simulation.summary.avgGdpChange < 0 ? "text-red" : "text-green"
            }`}
          >
            {simulation.summary.avgGdpChange >= 0 ? "+" : ""}
            {(simulation.summary.avgGdpChange * 100).toFixed(1)}%
          </div>
        </div>
        <div className="border-separator rounded-control border p-3 text-center">
          <div className="text-label-secondary text-footnote">GDP at Risk</div>
          <div className="text-label text-title-3">
            {formatCurrency(simulation.summary.totalGdpAtRisk)}
          </div>
        </div>
      </div>

      <Table containerClassName="h-[260px]">
        <TableHeader sticky>
          <TableRow>
            <TableHead className="px-3">Country</TableHead>
            <TableHead className="px-3">Tier</TableHead>
            <TableHead className="px-3 text-right">GDP Change</TableHead>
            <TableHead className="px-3 text-right">Pop change</TableHead>
            <TableHead className="px-3 text-right">Stability</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {simulation.projectedImpacts.map((p) => (
            <TableRow key={p.countryId}>
              <TableCell className="px-3 font-medium">{p.countryName}</TableCell>
              <TableCell className="px-3">
                <Badge variant="outline">{p.economicTier}</Badge>
              </TableCell>
              <TableCell
                className={`text-footnote px-3 py-2 text-right tabular-nums ${p.projected.gdpChange < 0 ? "text-red" : "text-green"}`}
              >
                {p.projected.gdpChange >= 0 ? "+" : ""}
                {(p.projected.gdpChange * 100).toFixed(1)}%
              </TableCell>
              <TableCell
                className={`text-footnote px-3 py-2 text-right tabular-nums ${p.projected.populationChange < 0 ? "text-red" : "text-green"}`}
              >
                {p.projected.populationChange >= 0 ? "+" : ""}
                {(p.projected.populationChange * 100).toFixed(2)}%
              </TableCell>
              <TableCell
                className={`text-footnote px-3 py-2 text-right tabular-nums ${p.projected.stabilityChange < 0 ? "text-red" : "text-green"}`}
              >
                {p.projected.stabilityChange >= 0 ? "+" : ""}
                {p.projected.stabilityChange.toFixed(0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
