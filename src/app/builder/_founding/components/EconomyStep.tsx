"use client";

import { forwardRef, useState } from "react";
import { Coins, Undo } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import {
  POPULATION_BANDS,
  WEALTH_BANDS,
  figureForPopulationBand,
  figureForWealthBand,
  type FoundingBand,
  type PopulationBandId,
  type WealthBandId,
} from "~/lib/builder/founding-bands";
import { getArchetypeOption } from "../lib/founding-archetypes";
import {
  DEFAULT_GDP_PER_CAPITA,
  DEFAULT_POPULATION,
  GDP_PER_CAPITA_RANGE,
  POPULATION_RANGE,
  effectiveBands,
  type EconomyFieldId,
  type FieldErrors,
  type FoundingDraft,
} from "../lib/founding-draft";
import { formatMoney, formatPeople } from "../lib/founding-format";
import { StepCard, fieldAria } from "./StepCard";

/** Where four band labels fit side by side. */
const ROOMY_QUERY = "(min-width: 640px)";

export const economyFieldId = (field: EconomyFieldId) => `founding-${field}`;

interface ExactFigureProps {
  id: string;
  label: string;
  value: number | null;
  /** The archetype's (or default) figure, as text: "Archetype: 20 million". */
  preset: string;
  range: string;
  unit: string;
  error?: string;
  onChange: (value: number | null) => void;
  onReset: () => void;
}

/** "Enter exact figure": a number with its range and the archetype's figure, and a reset to it. */
function ExactFigure({
  id,
  label,
  value,
  preset,
  range,
  unit,
  error,
  onChange,
  onReset,
}: ExactFigureProps) {
  const helper = `${preset} · Range ${range}`;
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-subhead text-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="numeric"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            const digits = event.target.value.replace(/[^\d.]/g, "");
            const parsed = digits ? Number(digits) : NaN;
            onChange(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null);
          }}
          {...fieldAria(id, error, helper)}
        />
        <span className="text-callout text-label-secondary shrink-0">{unit}</span>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-footnote text-destructive">
          {error}
        </p>
      )}
      <div className="text-label-secondary text-caption flex items-center justify-between gap-2">
        <span id={error ? undefined : `${id}-helper`} className="min-w-0">
          {helper}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onReset}
          aria-label={`Reset ${label.toLowerCase()}`}
          className="shrink-0"
        >
          <Undo aria-hidden className="size-3" />
          Reset
        </Button>
      </div>
    </div>
  );
}

/**
 * One band choice. A segmented control where four labels fit; on phones, where they would not,
 * the same choice as a two-by-two grid of radio cards.
 */
function BandChoice<Id extends string>({
  id,
  value,
  onChange,
  bands,
}: {
  id: string;
  value: Id;
  onChange: (band: Id) => void;
  bands: ReadonlyArray<FoundingBand<Id>>;
}) {
  const roomy = useMediaQuery(ROOMY_QUERY);
  const shared = { "aria-labelledby": `${id}-title`, "aria-describedby": `${id}-hint` };
  return roomy ? (
    <SegmentedControl
      {...shared}
      value={value}
      onValueChange={onChange}
      options={bands.map((band) => ({ value: band.id, label: band.label }))}
      fullWidth
    />
  ) : (
    <RadioCardGroup
      {...shared}
      value={value}
      onValueChange={(band) => onChange(band as Id)}
      className="grid grid-cols-2 gap-2"
    >
      {bands.map((band) => (
        <RadioCard key={band.id} value={band.id} title={band.label} />
      ))}
    </RadioCardGroup>
  );
}

interface EconomyStepProps {
  draft: FoundingDraft;
  errors: FieldErrors<EconomyFieldId>;
  onPopulationBand: (band: PopulationBandId) => void;
  onWealthBand: (band: WealthBandId) => void;
  onExact: (field: EconomyFieldId, value: number | null) => void;
  onReset: (field: EconomyFieldId) => void;
}

/** "How big and how wealthy?": two plain band choices, each with an exact figure on request. */
export const EconomyStep = forwardRef<HTMLDivElement, EconomyStepProps>(function EconomyStep(
  { draft, errors, onPopulationBand, onWealthBand, onExact, onReset },
  headingRef
) {
  const { economy } = draft;
  const bands = effectiveBands(draft);
  const archetype = getArchetypeOption(draft.start.archetypeKey)?.display;
  const [exactShown, setExactShown] = useState({
    exactPopulation: economy.exactPopulation !== null || !!errors.exactPopulation,
    exactGdpPerCapita: economy.exactGdpPerCapita !== null || !!errors.exactGdpPerCapita,
  });
  const show = (field: EconomyFieldId) => exactShown[field] || !!errors[field];
  const presetPopulation = archetype
    ? `Archetype: ${formatPeople(figureForPopulationBand(archetype.typicalPopulationBand))}`
    : `Default: ${formatPeople(DEFAULT_POPULATION)}`;
  const presetWealth = archetype
    ? `Archetype: ${formatMoney(figureForWealthBand(archetype.typicalWealthBand))}`
    : `Default: ${formatMoney(DEFAULT_GDP_PER_CAPITA)}`;
  const populationBand = POPULATION_BANDS.find((band) => band.id === bands.population)!;
  const wealthBand = WEALTH_BANDS.find((band) => band.id === bands.wealth)!;

  const reset = (field: EconomyFieldId) => {
    setExactShown((current) => ({ ...current, [field]: false }));
    onReset(field);
  };

  return (
    <StepCard
      ref={headingRef}
      id="founding-economy"
      icon={<Coins />}
      title="How big and how wealthy?"
      description="Your archetype filled these in. Jobs, sectors and the budget follow from them."
    >
      <section className="flex flex-col gap-3" aria-labelledby="founding-population-title">
        <h3 id="founding-population-title" className="text-headline text-label">
          Population
        </h3>
        <BandChoice
          id="founding-population"
          value={bands.population}
          onChange={(band) => {
            setExactShown((current) => ({ ...current, exactPopulation: false }));
            onPopulationBand(band);
          }}
          bands={POPULATION_BANDS}
        />
        <p id="founding-population-hint" className="text-footnote text-label-secondary">
          {populationBand.hint}.
        </p>
        {show("exactPopulation") ? (
          <ExactFigure
            id={economyFieldId("exactPopulation")}
            label="Exact population"
            value={economy.exactPopulation}
            preset={presetPopulation}
            range={`${formatPeople(POPULATION_RANGE.min)} to ${formatPeople(POPULATION_RANGE.max)}`}
            unit="people"
            error={errors.exactPopulation}
            onChange={(value) => onExact("exactPopulation", value)}
            onReset={() => reset("exactPopulation")}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setExactShown((current) => ({ ...current, exactPopulation: true }))}
          >
            Enter exact figure
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="founding-wealth-title">
        <h3 id="founding-wealth-title" className="text-headline text-label">
          Wealth
        </h3>
        <BandChoice
          id="founding-wealth"
          value={bands.wealth}
          onChange={(band) => {
            setExactShown((current) => ({ ...current, exactGdpPerCapita: false }));
            onWealthBand(band);
          }}
          bands={WEALTH_BANDS}
        />
        <p id="founding-wealth-hint" className="text-footnote text-label-secondary">
          {wealthBand.hint}. About {formatMoney(wealthBand.figure)} of output per person.
        </p>
        {show("exactGdpPerCapita") ? (
          <ExactFigure
            id={economyFieldId("exactGdpPerCapita")}
            label="Exact GDP per person"
            value={economy.exactGdpPerCapita}
            preset={presetWealth}
            range={`${formatMoney(GDP_PER_CAPITA_RANGE.min)} to ${formatMoney(GDP_PER_CAPITA_RANGE.max)}`}
            unit="US dollars"
            error={errors.exactGdpPerCapita}
            onChange={(value) => onExact("exactGdpPerCapita", value)}
            onReset={() => reset("exactGdpPerCapita")}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setExactShown((current) => ({ ...current, exactGdpPerCapita: true }))}
          >
            Enter exact figure
          </Button>
        )}
      </section>
    </StepCard>
  );
});
