"use client";

import { useState } from "react";
import { Community } from "iconoir-react";
import { api } from "~/trpc/react";
import { Signal } from "~/components/ui/signal";
import {
  bandForGdpPerCapita,
  bandForPopulation,
  POPULATION_BANDS,
  WEALTH_BANDS,
} from "~/lib/builder/founding-bands";
import { GDP_PER_CAPITA_LIMITS, POPULATION_LIMITS } from "~/lib/mycountry/editor-fields";
import { formatCompactCurrency, formatCompactNumber } from "~/lib/utils/format-utils";
import { EditorSection, SaveButton, TextField, useSaveHandlers } from "./EditorSection";
import { useEditor, useReportDirty } from "./editor-context";

/** Digits only, so "12,400,000" and "12 400 000" read as one number. */
const parseFigure = (text: string) => {
  const digits = text.replace(/[\s,_]/g, "");
  return /^\d+(\.\d+)?$/.test(digits) ? Number(digits) : null;
};

const asText = (value: number) => String(Math.round(value));

function figureError(
  value: number | null,
  limits: { min: number; max: number },
  format: (n: number) => string
): string | null {
  if (value === null) return "Enter a number.";
  if (value < limits.min || value > limits.max) {
    return `Use a figure from ${format(limits.min)} to ${format(limits.max)}.`;
  }
  return null;
}

function bandLine(bands: typeof POPULATION_BANDS | typeof WEALTH_BANDS, id: string) {
  const band = bands.find((b) => b.id === id);
  return band ? `${band.label}: ${band.hint}.` : undefined;
}

/**
 * Population and wealth, as exact figures. Saving makes them the nation's new starting point, so
 * the economy rescales; the Signal says so before the player saves.
 */
export function SizeSection({
  population: savedPopulation,
  gdpPerCapita: savedGdpPerCapita,
  baseline,
}: {
  population: number;
  gdpPerCapita: number;
  /** The baseline the figures project from: what a save is checked against. */
  baseline: { baselinePopulation: number; baselineGdpPerCapita: number };
}) {
  const { countryId } = useEditor();
  const [populationText, setPopulationText] = useState(asText(savedPopulation));
  const [gdpText, setGdpText] = useState(asText(savedGdpPerCapita));
  const population = parseFigure(populationText);
  const gdpPerCapita = parseFigure(gdpText);
  const dirty = populationText !== asText(savedPopulation) || gdpText !== asText(savedGdpPerCapita);
  useReportDirty("population", "Population and wealth", dirty);

  const populationError = dirty
    ? figureError(population, POPULATION_LIMITS, (n) => formatCompactNumber(n))
    : null;
  const gdpError = dirty
    ? figureError(gdpPerCapita, GDP_PER_CAPITA_LIMITS, (n) => formatCompactCurrency(n))
    : null;
  const valid = !populationError && !gdpError && population !== null && gdpPerCapita !== null;

  const handlers = useSaveHandlers({
    saved: "Size saved",
    failed: "Could not save the size",
    apply: (
      state,
      result: {
        baselinePopulation: number;
        baselineGdpPerCapita: number;
        currentPopulation: number;
        currentGdpPerCapita: number;
      }
    ) => ({ ...state, ...result }),
  });
  const save = api.countries.saveSize.useMutation(handlers);

  return (
    <EditorSection
      id="population"
      title="Population and wealth"
      icon={<Community />}
      description="How many people live in your nation and how much each produces a year."
    >
      <Signal tone="warning" title="Saving rescales the economy">
        These figures become your nation&apos;s new starting point. Total GDP, its tiers and the
        workforce are recalculated from them and growth continues from today. Budgets and tax rates
        stay as they are, so check them in their consoles afterwards.
      </Signal>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="editor-population"
          label="Population"
          inputMode="numeric"
          value={populationText}
          onChange={setPopulationText}
          error={populationError}
          helper={
            population !== null
              ? bandLine(POPULATION_BANDS, bandForPopulation(population))
              : undefined
          }
          className="tabular-nums"
        />
        <TextField
          id="editor-gdp-per-capita"
          label="GDP per person (USD a year)"
          inputMode="decimal"
          value={gdpText}
          onChange={setGdpText}
          error={gdpError}
          helper={
            gdpPerCapita !== null
              ? bandLine(WEALTH_BANDS, bandForGdpPerCapita(gdpPerCapita))
              : undefined
          }
          className="tabular-nums"
        />
      </div>
      {dirty && valid && (
        <p className="text-label text-callout tabular-nums" aria-live="polite">
          Total GDP: {formatCompactCurrency(savedPopulation * savedGdpPerCapita)} →{" "}
          {formatCompactCurrency(population * gdpPerCapita)}
        </p>
      )}
      <SaveButton
        section="population"
        label="Save size"
        dirty={dirty}
        invalid={!valid}
        pending={save.isPending}
        onSave={() =>
          population !== null &&
          gdpPerCapita !== null &&
          save.mutate({
            countryId,
            population: Math.round(population),
            gdpPerCapita,
            expected: baseline,
          })
        }
      />
    </EditorSection>
  );
}
