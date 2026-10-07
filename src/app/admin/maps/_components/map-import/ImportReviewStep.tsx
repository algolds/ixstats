"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { MapImportApplyInput } from "~/lib/maps/import/options";
import type { MapImportDiff } from "./useMapImportJob";

const STATUS: Record<string, { label: string; variant: "success" | "info" | "default" }> = {
  new: { label: "New", variant: "success" },
  changed: { label: "Changed", variant: "info" },
  unchanged: { label: "Same", variant: "default" },
};

const LAND_AREA: Record<string, string> = {
  fill: "Fills the missing land area",
  keep: "Keeps the stated land area",
  none: "",
};

const km2 = (v: number | null) => (v === null ? "" : `${Math.round(v).toLocaleString()} km²`);

interface ImportReviewStepProps {
  jobId: string;
  mapping: Record<string, string>;
  pixelSpace: boolean;
  busy: boolean;
  onBack: () => void;
  onApply: (apply: MapImportApplyInput) => void;
}

/** The dry run: what applying the mapping would write, retire and measure, before anything is written. */
export function ImportReviewStep({
  jobId,
  mapping,
  pixelSpace,
  busy,
  onBack,
  onApply,
}: ImportReviewStepProps) {
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [fillMissingLandArea, setFill] = useState(true);
  const [saveGeoreference, setSaveGeoreference] = useState(false);
  const apply: MapImportApplyInput = { mapping, mode, fillMissingLandArea, saveGeoreference };
  const preview = api.geoEditor.mapImport.preview.useQuery({ jobId, apply }, { retry: false });
  const diff: MapImportDiff | undefined = preview.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label>Mode</Label>
        <SegmentedControl
          aria-label="Import mode"
          value={mode}
          onValueChange={(next) => setMode(next as "merge" | "replace")}
          options={[
            { value: "merge", label: "Merge" },
            { value: "replace", label: "Replace" },
          ]}
        />
        <span className="text-label-secondary text-footnote">
          {mode === "merge"
            ? "Only the imported nations' borders change."
            : "Every other political region of the realm is retired."}
        </span>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="import-fill-land"
            checked={fillMissingLandArea}
            onCheckedChange={(v) => setFill(v === true)}
          />
          <Label htmlFor="import-fill-land">
            Fill a nation&apos;s land area from its border when it has none
          </Label>
        </div>
        {pixelSpace && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="import-save-georef"
              checked={saveGeoreference}
              onCheckedChange={(v) => setSaveGeoreference(v === true)}
            />
            <Label htmlFor="import-save-georef">Save this georeference as the realm&apos;s</Label>
          </div>
        )}
      </div>

      {preview.isLoading && (
        <p className="text-label-secondary text-footnote">Working out the changes…</p>
      )}
      {preview.error && <p className="text-destructive text-footnote">{preview.error.message}</p>}
      {diff && <DiffDetails diff={diff} />}

      <div className="flex gap-2">
        <Button
          onClick={() => onApply(apply)}
          disabled={busy || !diff || diff.features.length === 0}
        >
          {busy ? "Starting…" : `Apply ${diff?.features.length ?? 0} borders`}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Back to the mapping
        </Button>
      </div>
    </div>
  );
}

function DiffDetails({ diff }: { diff: MapImportDiff }) {
  const counts = { new: 0, changed: 0, unchanged: 0 };
  for (const f of diff.features) counts[f.status]++;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">{counts.new} new</Badge>
        <Badge variant="info">{counts.changed} changed</Badge>
        <Badge>{counts.unchanged} unchanged</Badge>
        {diff.mode === "replace" ? (
          <Badge variant={diff.removed.length ? "destructive" : "default"}>
            {diff.removed.length} retired
          </Badge>
        ) : (
          <Badge>{diff.kept} kept as they are</Badge>
        )}
        {diff.areaScale !== 1 && (
          <Badge variant="secondary">Areas on the realm&apos;s planet</Badge>
        )}
      </div>
      {diff.georef && diff.georef.warnings.length > 0 && (
        <p className="text-warning-ink text-footnote">{diff.georef.warnings.join(" ")}</p>
      )}
      <Table containerClassName="max-h-80">
        <TableHeader sticky>
          <TableRow>
            {["Nation", "Status", "Area", "Land area", "Link"].map((h) => (
              <TableHead key={h} className="px-3">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {diff.features.map((f) => (
            <TableRow key={f.key}>
              <TableCell className="text-body px-3 py-2">{f.nation}</TableCell>
              <TableCell className="px-3 py-2">
                <Badge variant={STATUS[f.status]!.variant}>{STATUS[f.status]!.label}</Badge>
              </TableCell>
              <TableCell className="text-footnote px-3 py-2 tabular-nums">
                {km2(f.areaKm2)}
              </TableCell>
              <TableCell className="text-label-secondary text-footnote px-3 py-2">
                {LAND_AREA[f.landArea.action]}
              </TableCell>
              <TableCell className="text-label-secondary text-footnote px-3 py-2">
                {f.countryName ?? "No country yet"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {diff.removed.length > 0 && (
        <p className="text-destructive text-footnote">
          Retired:{" "}
          {diff.removed
            .map((r) =>
              r.countryName ? `${r.name ?? r.key} (${r.countryName})` : (r.name ?? r.key)
            )
            .join(", ")}
        </p>
      )}
      {diff.newNames.length > 0 && (
        <p className="text-warning-ink text-footnote">
          Not nations of the realm yet: {diff.newNames.map((n) => n.nation).join(", ")}
        </p>
      )}
      {diff.unmatched.length > 0 && (
        <p className="text-label-secondary text-footnote">
          {diff.unmatched.length} region{diff.unmatched.length === 1 ? "" : "s"} not imported:{" "}
          {diff.unmatched
            .slice(0, 12)
            .map((r) => r.name ?? r.colour ?? r.key)
            .join(", ")}
          {diff.unmatched.length > 12 ? "…" : ""}
        </p>
      )}
      {diff.empty.length > 0 && (
        <p className="text-warning-ink text-footnote">Too small to draw: {diff.empty.join(", ")}</p>
      )}
    </div>
  );
}
