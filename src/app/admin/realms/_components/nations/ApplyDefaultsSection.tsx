"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ECONOMIC_TIERS, growthPercent } from "~/lib/realms/nation-growth-defaults";

type Preview = RouterOutputs["realms"]["nationDefaults"]["preview"];
type Change = Preview["sample"][number];

const CHANGE_COLUMNS: ReadonlyArray<{ key: keyof Change["to"]; label: string }> = [
  { key: "populationGrowthRate", label: "Population growth" },
  { key: "adjustedGdpGrowth", label: "Adjusted GDP growth" },
  { key: "maxGdpGrowthRate", label: "Max GDP growth" },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function PreviewResult({ preview }: { preview: Preview }) {
  const tiers = ECONOMIC_TIERS.filter((tier) => preview.byTier[tier]).map(
    (tier) => `${tier} ${preview.byTier[tier]}`
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-callout">
        {plural(preview.changed, "unclaimed nation", "unclaimed nations")} of {preview.unclaimed}{" "}
        would change; {preview.unchanged} already match.
        {tiers.length > 0 && <> By tier: {tiers.join(", ")}.</>}
      </p>
      {preview.sample.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nation</TableHead>
              <TableHead>Tier</TableHead>
              {CHANGE_COLUMNS.map((column) => (
                <TableHead key={column.key} numeric>
                  {column.label} (%)
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.sample.map((change) => (
              <TableRow key={change.id}>
                <TableCell>{change.name}</TableCell>
                <TableCell>{change.tier}</TableCell>
                {CHANGE_COLUMNS.map((column) => (
                  <TableCell key={column.key} numeric>
                    {growthPercent(change.from[column.key])} to{" "}
                    {growthPercent(change.to[column.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {preview.changed > preview.sample.length && (
        <p className="text-label-secondary text-footnote">
          Showing {preview.sample.length} of {preview.changed}. The audit log records every nation
          an apply writes.
        </p>
      )}
    </div>
  );
}

/**
 * Applying the saved table to the realm's unclaimed nations: a dry run first (counts and a sample), then the
 * apply. Claimed nations are never touched.
 */
export function ApplyDefaultsSection({
  realmId,
  nations,
  unclaimed,
  unsaved,
}: {
  realmId: string;
  nations: number;
  unclaimed: number;
  unsaved: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const preview = api.realms.nationDefaults.preview.useMutation({
    onError: (e) => notify.error("Dry run failed", e.message),
  });
  const apply = api.realms.nationDefaults.applyToUnclaimed.useMutation({
    onSuccess: (result) => {
      notify.success(
        "Nation defaults applied",
        `${plural(result.updated, "unclaimed nation", "unclaimed nations")} updated.`
      );
      preview.reset();
    },
    onError: (e) => notify.error("Could not apply the nation defaults", e.message),
    onSettled: () => void utils.realms.nationDefaults.get.invalidate({ realmId }),
  });
  const busy = preview.isPending || apply.isPending;

  return (
    <section className="border-separator bg-surface rounded-card flex flex-col gap-4 border p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-label text-headline">Apply to unclaimed nations</h3>
          <p className="text-label-secondary text-footnote">
            {unclaimed} of {nations} nations are unclaimed. Applying writes the saved table to them
            by tier; claimed nations keep their own growth.
            {unsaved && " Save your changes first: applying uses the saved table."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || unsaved}
            onClick={() => preview.mutate({ realmId })}
          >
            {preview.isPending ? "Checking…" : "Dry run"}
          </Button>
          <Button
            size="sm"
            disabled={busy || unsaved || !preview.data || preview.data.changed === 0}
            onClick={() => apply.mutate({ realmId })}
          >
            {apply.isPending ? "Applying…" : "Apply"}
          </Button>
        </div>
      </div>
      {preview.data && <PreviewResult preview={preview.data} />}
    </section>
  );
}
