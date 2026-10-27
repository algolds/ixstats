import { Card } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import { RealmFlags } from "./RealmFlags";
import { reliefLabel, type RealmRow } from "./realms-view";

interface RealmFiguresProps {
  realm: RealmRow;
  /** Active feature count per layer type */
  layerCounts: Record<string, number>;
  /** The relief folders were not all checked in time */
  partial: boolean;
}

/** A realm's map figures: layers, relief, linkage, nations, claims, geometry, version and problems. */
export function RealmFigures({ realm, layerCounts, partial }: RealmFiguresProps) {
  const { layers, linkage, nations } = realm;
  return (
    <Card content="data" padding="md" className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          size="sm"
          label="Layers"
          value={`${layers.present} of ${layers.total}`}
          hint={layers.missing.length > 0 ? `Missing ${layers.missing.join(", ")}` : "All present"}
        />
        <Stat
          size="sm"
          label="Relief"
          value={reliefLabel(realm.relief)}
          hint={partial && realm.relief === "unknown" ? "Not checked in time" : undefined}
        />
        <Stat
          size="sm"
          label="Linkage"
          value={`${linkage.linked} of ${linkage.total}`}
          hint="Political features linked to a nation"
        />
        <Stat
          size="sm"
          label="Nations"
          value={nations.total}
          hint={`${nations.owned} owned, ${nations.open} open, ${nations.reserved} reserved`}
        />
        <Stat size="sm" label="Pending claims" value={realm.pendingClaims} />
        <Stat size="sm" label="Invalid geometry" value={realm.invalidGeometry} />
        <Stat size="sm" label="Map version" value={realm.mapVersion} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-label text-body font-medium">Problems</h3>
        <RealmFlags row={realm} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        {Object.entries(layerCounts).map(([type, count]) => (
          <div key={type} className="flex justify-between gap-2">
            <dt className="text-label-secondary capitalize">{type}</dt>
            <dd className="text-label tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
