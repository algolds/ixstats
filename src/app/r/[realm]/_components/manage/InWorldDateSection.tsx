"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  formatInWorldDate,
  InWorldDateSchema,
  MAX_IN_WORLD_ERA,
  MAX_IN_WORLD_LABEL,
  type InWorldDate,
} from "~/lib/realms/realm-community";
import { ManageSection } from "./ManageSection";

type Mode = "none" | InWorldDate["mode"];

/**
 * The in-world date in the realm header: a label the staff set (optionally "as of" a real date), or a year that
 * follows the real one with an offset and an era. Display only; the simulation keeps the shared IxTime clock.
 */
export function InWorldDateSection({
  slug,
  inWorldDate,
}: {
  slug: string;
  inWorldDate: InWorldDate | null;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [mode, setMode] = useState<Mode>(inWorldDate?.mode ?? "none");
  const [label, setLabel] = useState(inWorldDate?.mode === "fixed" ? inWorldDate.label : "");
  const [asOf, setAsOf] = useState(inWorldDate?.mode === "fixed" ? (inWorldDate.asOf ?? "") : "");
  const [offset, setOffset] = useState(
    inWorldDate?.mode === "offset" ? String(inWorldDate.offset) : "0"
  );
  const [era, setEra] = useState(inWorldDate?.mode === "offset" ? (inWorldDate.era ?? "") : "");
  const save = api.realms.region.updateInWorldDate.useMutation({
    onSuccess: () => {
      notify.success("In-world date saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the in-world date", error.message),
  });

  const draft =
    mode === "fixed"
      ? { mode, label: label.trim(), asOf: asOf || null }
      : mode === "offset"
        ? { mode, offset: Number(offset), era: era.trim() || null }
        : null;
  const parsed = draft ? InWorldDateSchema.safeParse(draft) : null;
  const value = parsed?.success ? parsed.data : null;
  const preview = formatInWorldDate(value);

  return (
    <ManageSection
      id="calendar"
      title="In-world date"
      description="Shown in the realm header. It is a label only: the simulation keeps running on IxTime."
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          aria-label="In-world date mode"
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "none", label: "None" },
            { value: "fixed", label: "Fixed label" },
            { value: "offset", label: "Yearly offset" },
          ]}
        />
        {mode === "fixed" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="in-world-label">Date</Label>
              <Input
                id="in-world-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={MAX_IN_WORLD_LABEL}
                placeholder="14 Harvest 1203 AE"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="in-world-as-of">As of (optional)</Label>
              <Input
                id="in-world-as-of"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
          </div>
        )}
        {mode === "offset" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="in-world-offset">Years added to the real year</Label>
              <Input
                id="in-world-offset"
                type="number"
                step={1}
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="in-world-era">Era (optional)</Label>
              <Input
                id="in-world-era"
                value={era}
                onChange={(e) => setEra(e.target.value)}
                maxLength={MAX_IN_WORLD_ERA}
                placeholder="AE"
              />
            </div>
          </div>
        )}
        {preview && (
          <p className="text-label-secondary text-footnote">
            The header reads: <span className="text-label font-medium">{preview.label}</span>
          </p>
        )}
        <div>
          <Button
            size="sm"
            disabled={(mode !== "none" && !value) || save.isPending}
            onClick={() => save.mutate({ slug, inWorldDate: value })}
          >
            Save in-world date
          </Button>
        </div>
      </div>
    </ManageSection>
  );
}
