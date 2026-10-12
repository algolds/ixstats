"use client";

import { Card } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  calibrationReadout,
  type CalibrationReadout,
  type CalibrationRow,
} from "~/lib/worldgen/world-calibration";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

const figure = (value: number | null) => (value === null ? "–" : `${value.toFixed(1)}%`);

const cell = "px-2 py-1 text-footnote";

function Row({ row }: { row: CalibrationRow }) {
  return (
    <TableRow>
      <TableCell className={`${cell} whitespace-normal`}>{row.label}</TableCell>
      <TableCell numeric className={cell}>
        {figure(row.draft)}
      </TableCell>
      <TableCell numeric className={cell}>
        {figure(row.ixnay)}
      </TableCell>
      <TableCell numeric className={cell}>
        {figure(row.eurth)}
      </TableCell>
    </TableRow>
  );
}

function GroupHeading({ children }: { children: string }) {
  return (
    <TableRow>
      <TableHead colSpan={4} className="text-label h-auto px-2 pt-3 pb-1 text-left">
        {children}
      </TableHead>
    </TableRow>
  );
}

/** The studio's readout: the draft world's land share, elevation profile and climate mix against both reference maps. */
export function CalibrationTable({ readout }: { readout: CalibrationReadout }) {
  return (
    <Card content="data" padding="sm" aria-label="Calibration against Ixnay and Eurth">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-auto px-2 py-1">Measure</TableHead>
            <TableHead numeric className="h-auto px-2 py-1">
              Draft
            </TableHead>
            <TableHead numeric className="h-auto px-2 py-1">
              Ixnay
            </TableHead>
            <TableHead numeric className="h-auto px-2 py-1">
              Eurth
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Row row={readout.landShare} />
          <GroupHeading>Elevation zones, share of land</GroupHeading>
          {readout.hypsometry.map((row) => (
            <Row key={row.label} row={row} />
          ))}
          <GroupHeading>Climate groups, share of land</GroupHeading>
          {readout.climate.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </TableBody>
      </Table>
      <p className="text-label-secondary text-footnote mt-2">
        Average gap over the zones and groups: {readout.distance.ixnay.toFixed(1)} points from
        Ixnay, {readout.distance.eurth.toFixed(1)} from Eurth.
      </p>
    </Card>
  );
}

/** Sandbox only: shown instead of the apply region, since the studio never changes a realm. */
export function WorldCalibration({ result }: { result: WorldGenResult | null }) {
  if (!result) {
    return (
      <p className="text-label-secondary text-footnote">
        Generate a preview to compare it with Ixnay and Eurth.
      </p>
    );
  }
  return <CalibrationTable readout={calibrationReadout(result)} />;
}
