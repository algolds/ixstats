"use client";

import { calibrationDistance } from "~/lib/worldgen/calibration-distance";
import { amountGap, compact, percent, shareGap } from "~/lib/worldgen/calibration-format";
import type { WorldMeasures } from "~/lib/worldgen/measure-world";
import type { RealmFigures } from "~/hooks/useStudioCalibration";

interface FigureRow {
  label: string;
  value: (measures: WorldMeasures) => number;
  format: (value: number) => string;
  gap: (world: number, realm: number) => string;
}

const FIGURES: readonly FigureRow[] = [
  { label: "Land share", value: (m) => m.landShare, format: percent, gap: shareGap },
  {
    label: "Nations",
    value: (m) => m.nations.count,
    format: (n) => String(Math.round(n)),
    gap: amountGap,
  },
  {
    label: "Median nation",
    value: (m) => m.nations.medianKm2,
    format: (n) => `${compact(n)} km²`,
    gap: amountGap,
  },
  {
    label: "Largest tenth",
    value: (m) => m.nations.p90Km2,
    format: (n) => `${compact(n)} km²`,
    gap: amountGap,
  },
  {
    label: "Coastline",
    value: (m) => m.coastlineKm,
    format: (n) => `${compact(n)} km`,
    gap: amountGap,
  },
];

interface StudioCalibrationTableProps {
  world: WorldMeasures;
  columns: readonly RealmFigures[];
  /** The world is fitted to a realm's borders and has no nations: the distance leaves them out */
  skipNations: boolean;
}

function ColumnHead({
  column,
  world,
  skipNations,
}: {
  column: RealmFigures;
  world: WorldMeasures;
  skipNations: boolean;
}) {
  return (
    <th scope="col" className="px-1 pb-2 text-left align-bottom font-medium">
      <span className="block truncate" title={column.name}>
        {column.name}
      </span>
      {column.state === "ready" && (
        <span className="text-label-secondary text-caption block font-normal tabular-nums">
          Distance{" "}
          {Math.round(
            calibrationDistance(world, column.measures, { nations: !skipNations }).distance
          )}
        </span>
      )}
      {column.state === "loading" && (
        <span role="status" className="text-label-secondary text-caption block font-normal">
          Measuring
        </span>
      )}
      {(column.state === "unmeasurable" || column.state === "failed") && (
        <span
          role={column.state === "failed" ? "alert" : "status"}
          className="text-label-secondary text-caption block font-normal"
        >
          {column.reason}
        </span>
      )}
    </th>
  );
}

/**
 * The scalar figures, the world beside each realm, each realm cell with the gap (world minus realm) under its value.
 * A realm without figures keeps its column, with the reason in its heading.
 */
export function StudioCalibrationTable({
  world,
  columns,
  skipNations,
}: StudioCalibrationTableProps) {
  return (
    <table className="text-footnote w-full table-fixed">
      <caption className="sr-only">This world beside the chosen realms</caption>
      <thead>
        <tr>
          <th scope="col" className="w-20 px-1 pb-2 text-left align-bottom font-medium">
            Figure
          </th>
          <th scope="col" className="px-1 pb-2 text-left align-bottom font-medium">
            World
          </th>
          {columns.map((column) => (
            <ColumnHead key={column.slug} column={column} world={world} skipNations={skipNations} />
          ))}
        </tr>
      </thead>
      <tbody>
        {FIGURES.map(({ label, value, format, gap }) => (
          <tr key={label} className="border-separator border-t">
            <th
              scope="row"
              className="text-label-secondary px-1 py-2 text-left align-top font-normal"
            >
              {label}
            </th>
            <td className="px-1 py-2 align-top tabular-nums">{format(value(world))}</td>
            {columns.map((column) => (
              <td key={column.slug} className="px-1 py-2 align-top tabular-nums">
                {column.state === "ready" ? (
                  <>
                    <span className="block">{format(value(column.measures))}</span>
                    <span className="text-label-secondary text-caption block">
                      {gap(value(world), value(column.measures))}
                    </span>
                  </>
                ) : (
                  <span className="text-label-secondary">-</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
