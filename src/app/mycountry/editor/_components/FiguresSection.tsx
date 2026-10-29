"use client";

import { useState } from "react";
import { Percentage } from "iconoir-react";
import { api } from "~/trpc/react";
import {
  isBlankFigure,
  type EconomicFigures,
  type EstimatedField,
} from "~/lib/economy/figure-estimates";
import { ECONOMIC_FIGURE_FIELDS, economicFigureError } from "~/lib/mycountry/editor-fields";
import { EditorSection, SaveButton, TextField, useSaveHandlers } from "./EditorSection";
import { useEditor, useReportDirty } from "./editor-context";

export type StoredFigures = Record<EstimatedField, number | null>;

/** A stored figure as the field shows it: empty when it reads as blank (null, or a 0 inflation or unemployment). */
const asText = (key: EstimatedField, value: number | null) =>
  value === null || isBlankFigure(key, value) ? "" : String(value);

/** Empty is no figure (null); otherwise a plain decimal, NaN when the text is not one. */
function parsePercent(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function fieldError(key: EstimatedField, value: number | null): string | null {
  return value !== null && Number.isNaN(value)
    ? "Enter a number."
    : economicFigureError(key, value);
}

function hint(text: string, estimate: number | undefined): string {
  if (estimate === undefined) return "Leave it empty to estimate it from your economy.";
  return text.trim() === ""
    ? `Estimated from your economy: ${estimate}%. Type a figure to replace it.`
    : `Leave it empty to use the estimate from your economy (${estimate}%).`;
}

/**
 * Inflation, unemployment and public debt as the nation records them. An empty field is estimated from the
 * economy (what issues and the economy report read); typing a figure replaces the estimate, clearing it returns it.
 */
export function FiguresSection({
  stored,
  estimates,
}: {
  stored: StoredFigures;
  estimates: EconomicFigures | null;
}) {
  const { countryId } = useEditor();
  const [texts, setTexts] = useState(
    () =>
      Object.fromEntries(
        ECONOMIC_FIGURE_FIELDS.map((f) => [f.key, asText(f.key, stored[f.key])])
      ) as Record<EstimatedField, string>
  );
  const changed = ECONOMIC_FIGURE_FIELDS.filter(
    (f) => texts[f.key] !== asText(f.key, stored[f.key])
  );
  const dirty = changed.length > 0;
  useReportDirty("figures", "Economic figures", dirty);

  const values = Object.fromEntries(
    ECONOMIC_FIGURE_FIELDS.map((f) => [f.key, parsePercent(texts[f.key])])
  ) as Record<EstimatedField, number | null>;
  const errors = Object.fromEntries(
    ECONOMIC_FIGURE_FIELDS.map((f) => [f.key, fieldError(f.key, values[f.key])])
  ) as Record<EstimatedField, string | null>;
  const valid = changed.every((f) => errors[f.key] === null);

  const handlers = useSaveHandlers({
    saved: "Economic figures saved",
    failed: "Could not save the economic figures",
    apply: (state, result: Partial<StoredFigures>) => ({ ...state, ...result }),
  });
  const save = api.countries.saveEconomicFigures.useMutation(handlers);

  return (
    <EditorSection
      id="figures"
      title="Economic figures"
      icon={<Percentage />}
      description="Inflation, unemployment and public debt. Leave one empty and it is estimated from your economy."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {ECONOMIC_FIGURE_FIELDS.map((f) => (
          <TextField
            key={f.key}
            id={`editor-${f.key}`}
            label={f.label}
            inputMode="decimal"
            value={texts[f.key]}
            onChange={(text) => setTexts((current) => ({ ...current, [f.key]: text }))}
            placeholder={estimates ? String(estimates[f.key]) : undefined}
            error={errors[f.key]}
            helper={hint(texts[f.key], estimates?.[f.key])}
            className="tabular-nums"
          />
        ))}
      </div>
      <SaveButton
        section="figures"
        label="Save economic figures"
        dirty={dirty}
        invalid={!valid}
        pending={save.isPending}
        onSave={() =>
          save.mutate({
            countryId,
            figures: Object.fromEntries(changed.map((f) => [f.key, values[f.key]])),
            expected: Object.fromEntries(changed.map((f) => [f.key, stored[f.key]])),
          })
        }
      />
    </EditorSection>
  );
}
