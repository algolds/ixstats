"use client";

import { Button } from "~/components/ui/button";
import { ValueSelect } from "~/components/ui/value-select";
import { useStudioCalibration, type RealmFigures } from "~/hooks/useStudioCalibration";
import { percent } from "~/lib/worldgen/calibration-format";
import { CLIMATE_GROUP_NAMES, TREWARTHA_GROUPS } from "~/lib/worldgen/measure-world";
import { ELEVATION_ZONES } from "~/lib/worldgen/v2/config";
import { StudioCalibrationBars, barSeries } from "./StudioCalibrationBars";
import { StudioCalibrationTable } from "./StudioCalibrationTable";
import { useStudio } from "./StudioContext";

const NONE = "none";
const ZONE_NAMES = ELEVATION_ZONES.map((zone) => zone.name);
const GROUP_NAMES = TREWARTHA_GROUPS.map((group) => CLIMATE_GROUP_NAMES[group]);

function RealmPickers({
  chosen,
  choose,
}: Pick<ReturnType<typeof useStudioCalibration>, "chosen" | "choose">) {
  const { realms, realmsState } = useStudio();
  const options = realms.map((realm): [string, string] => [realm.slug, realm.name]);
  return (
    <div className="grid grid-cols-2 gap-2">
      <ValueSelect
        aria-label="First realm to compare with"
        size="sm"
        value={chosen[0] ?? NONE}
        options={[[NONE, "No realm"], ...options]}
        onValueChange={(slug) => choose(0, slug === NONE ? null : slug)}
        disabled={realmsState !== "ready"}
      />
      <ValueSelect
        aria-label="Second realm to compare with"
        size="sm"
        value={chosen[1] ?? NONE}
        options={[[NONE, "No second realm"], ...options]}
        onValueChange={(slug) => choose(1, slug === NONE ? null : slug)}
        disabled={realmsState !== "ready"}
      />
    </div>
  );
}

/** The unclassified remainder of each source's land, said only where some land has no climate group. */
function Unclassified({ world, columns }: { world: number; columns: readonly RealmFigures[] }) {
  const parts = [
    { name: "World", share: world },
    ...columns.flatMap((c) =>
      c.state === "ready" ? [{ name: c.name, share: c.measures.unclassifiedShare }] : []
    ),
  ];
  if (parts.every((part) => part.share <= 0)) return null;
  return (
    <p className="text-label-secondary text-caption">
      Land with no climate group, left out of the bars:{" "}
      {parts.map((part) => `${part.name} ${percent(part.share)}`).join(", ")}.
    </p>
  );
}

/** Calibration: this world's measures beside one or two realms' (Ixnay and Eurth to start), with a distance each. */
export function StudioCalibrationTab() {
  const { generator, realms, realmsState, stale, source } = useStudio();
  const { world, columns, chosen, choose, retry } = useStudioCalibration(generator, realms);

  return (
    <div className="space-y-4 p-3">
      <div className="space-y-2">
        <h3 className="text-headline">Calibration</h3>
        <p className="text-label-secondary text-caption">
          The distance is the mean of five gaps (land share, elevation, climate, nations and
          coastline) on a scale of 0, the same map, to 100, nothing in common.
        </p>
        {realmsState === "failed" && (
          <p role="alert" className="text-destructive text-caption">
            The realms could not be read, so there is nothing to compare with.
          </p>
        )}
        <RealmPickers chosen={chosen} choose={choose} />
      </div>

      {world.state === "none" && (
        <p role="status" className="text-label-secondary text-footnote">
          There is no world to measure yet.
        </p>
      )}
      {world.state === "measuring" && (
        <p role="status" className="text-label-secondary text-footnote">
          Measuring the world.
        </p>
      )}
      {world.state === "failed" && (
        <div className="space-y-2">
          <p role="alert" className="text-destructive text-footnote">
            The world could not be measured: {world.error}
          </p>
          <Button size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {world.state === "ready" && (
        <>
          {(stale || source.kind === "fit") && (
            <p className="text-label-secondary text-caption">
              {stale
                ? "The world is being made again; these figures are for the one before."
                : "A world fitted to a realm keeps that realm's borders, so it has no nations of its own."}
            </p>
          )}
          <StudioCalibrationTable world={world.measures} columns={columns} />
          <StudioCalibrationBars
            title="Land by elevation"
            labels={ZONE_NAMES}
            series={barSeries(world.measures.hypsometry, columns, (m) => m.hypsometry)}
          />
          <StudioCalibrationBars
            title="Climate of the classified land"
            labels={GROUP_NAMES}
            series={barSeries(
              TREWARTHA_GROUPS.map((g) => world.measures.climate[g]),
              columns,
              (m) => TREWARTHA_GROUPS.map((g) => m.climate[g])
            )}
          />
          <Unclassified world={world.measures.unclassifiedShare} columns={columns} />
        </>
      )}
    </div>
  );
}
