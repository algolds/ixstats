"use client";
/**
 * The pack editor's odds and pool: odds per rarity with their total, the card type and pool filter, and the pool
 * preview, which says what keeps the pack off sale.
 */
import { useId, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";
import { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import {
  PACK_CARD_TYPES,
  PACK_ODDS_FIELDS,
  PackOddsSchema,
  oddsAddUp,
  packOddsTotal,
  rarityList,
  type PackOdds,
} from "~/lib/cards/pack-odds";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ValueSelect } from "~/components/ui/value-select";
import {
  CARD_TYPE_LABELS,
  RARITY_LABELS,
  type CardTypeValue,
  type RarityValue,
} from "../shared/card-labels";

type Pool = RouterInputs["cards"]["admin"]["packs"]["save"]["pool"];
type PreviewInput = RouterInputs["cards"]["admin"]["packs"]["preview"];
type Preview = RouterOutputs["cards"]["admin"]["packs"]["preview"];

const CATEGORY_OPTIONS = Object.values(LoreCategory).map(
  (category) => [category, getCategoryLabel(category)] as const
);
/** Special and Trophy cards never drop from packs, so the pool offers only the types that do. */
const TYPE_OPTIONS = PACK_CARD_TYPES.map((type) => [type, CARD_TYPE_LABELS[type]] as const);
const CARD_TYPE_OPTIONS: readonly (readonly [CardTypeValue | "any", string])[] = [
  ["any", "Any type"],
  ...TYPE_OPTIONS,
];

interface PoolTogglesProps<T extends string> {
  label: string;
  /** What an empty selection means, e.g. "every realm". */
  none: string;
  options: readonly (readonly [T, string])[];
  value: readonly T[];
  onChange: (value: T[]) => void;
}

/**
 * One multi-select pool filter; the chosen values keep the options' order. Stored values the list does not show (a
 * realm missing from the list, a type that never drops) stay through every toggle, so a save never widens the pool.
 */
function PoolToggles<T extends string>({
  label,
  none,
  options,
  value,
  onChange,
}: PoolTogglesProps<T>) {
  const id = useId();
  const listed = options.map(([option]) => option);
  const unlisted = value.filter((item) => !listed.includes(item));
  return (
    <div className="space-y-2">
      <p id={id} className="text-subhead text-label">
        {label} <span className="text-label-secondary">· none picked means {none}</span>
      </p>
      <ToggleGroup
        type="multiple"
        variant="pill"
        size="sm"
        aria-labelledby={id}
        value={[...value]}
        onValueChange={(next) =>
          onChange([...listed.filter((option) => next.includes(option)), ...unlisted])
        }
      >
        {options.map(([option, optionLabel]) => (
          <ToggleGroupItem key={option} value={option}>
            {optionLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {unlisted.length > 0 && (
        <p className="text-footnote text-label-secondary">
          {`Also keeps ${unlisted.length} stored ${unlisted.length === 1 ? "value" : "values"} not listed here.`}
        </p>
      )}
    </div>
  );
}

/**
 * The pool preview: off until asked for, then it follows the edits, waiting while the odds are not valid. `data` is
 * the preview shown, so a result cached from an earlier visit stays hidden until asked for.
 */
export function usePackPoolPreview(input: PreviewInput) {
  const [previewing, setPreviewing] = useState(false);
  const oddsValid = PackOddsSchema.safeParse(input.odds).success;
  const query = api.cards.admin.packs.preview.useQuery(input, {
    enabled: previewing && oddsValid,
    placeholderData: keepPreviousData,
  });
  return {
    previewing,
    start: () => setPreviewing(true),
    oddsValid,
    data: previewing ? query.data : undefined,
    isError: query.isError,
    isFetching: query.isFetching,
  };
}
type PackPoolPreview = ReturnType<typeof usePackPoolPreview>;

/** "Epic has odds but no cards…", for the rarities the pack gives odds for with nothing to draw. */
function oddsGapNote(rarities: readonly RarityValue[]): string {
  const one = rarities.length === 1;
  return `${rarityList(rarities, RARITY_LABELS)} ${one ? "has" : "have"} odds but no cards, so this pack can't go on sale. Set ${one ? "its" : "their"} odds to 0 or widen the pool.`;
}

/** Bought packs wait unopened while their pool can't give a rarity they show. */
function unopenedNote(unopened: number, rarities: number): string {
  const packs = `${unopened.toLocaleString()} bought ${unopened === 1 ? "pack" : "packs"}`;
  return `${packs} can't be opened until ${rarities === 1 ? "that rarity has" : "those rarities have"} cards.`;
}

function PoolPreview({
  preview,
  guaranteedRarity,
}: {
  preview: Preview;
  guaranteedRarity: RarityValue | null;
}) {
  // Each rarity keeping the pack off sale is named once: the guarantee on its own line, the others by their odds
  const oddsGaps = preview.undeliverable.filter((rarity) => rarity !== guaranteedRarity);
  const guaranteeGap =
    guaranteedRarity && preview.undeliverable.includes(guaranteedRarity) ? guaranteedRarity : null;
  return (
    <div className="space-y-2">
      <p className="text-footnote text-label-secondary">
        {preview.total.toLocaleString()} approved cards in the pool
      </p>
      <ul className="flex flex-wrap gap-2">
        {preview.byRarity.map((row) => (
          <li key={row.rarity}>
            <Badge variant={row.empty ? "warning" : "default"}>
              {`${RARITY_LABELS[row.rarity]}: ${row.count.toLocaleString()}${row.empty ? ", none to draw" : ""}`}
            </Badge>
          </li>
        ))}
      </ul>
      {oddsGaps.length > 0 && (
        <p className="text-footnote text-warning-ink">{oddsGapNote(oddsGaps)}</p>
      )}
      {guaranteeGap && (
        <p className="text-footnote text-warning-ink">
          {`No ${RARITY_LABELS[guaranteeGap]} cards are in this pool, so the guarantee can't be met.`}
        </p>
      )}
      {preview.undeliverable.length > 0 && preview.unopened > 0 && (
        <p className="text-footnote text-warning-ink">
          {unopenedNote(preview.unopened, preview.undeliverable.length)}
        </p>
      )}
      {preview.samples.length === 0 ? (
        <p className="text-footnote text-label-secondary">No cards match this pool.</p>
      ) : (
        <ul aria-label="Some cards in the pool" className="text-footnote space-y-1">
          {preview.samples.map((card) => (
            <li key={card.id}>
              <span className="text-label">{card.title}</span>{" "}
              <span className="text-label-secondary">
                {RARITY_LABELS[card.rarity]} · {card.realmName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PackPoolFieldsProps {
  odds: PackOdds;
  onOddsChange: (odds: PackOdds) => void;
  pool: Pool;
  onPoolChange: (pool: Pool) => void;
  /** The one type the pack draws, or null for any. */
  cardType: CardTypeValue | null;
  onCardTypeChange: (cardType: CardTypeValue | null) => void;
  /** The pack's own season: read-only here, it narrows the pool. */
  season: number | null;
  guaranteedRarity: RarityValue | null;
  preview: PackPoolPreview;
}

export function PackPoolFields({
  odds,
  onOddsChange,
  pool,
  onPoolChange,
  cardType,
  onCardTypeChange,
  season,
  guaranteedRarity,
  preview,
}: PackPoolFieldsProps) {
  const realms = api.cards.admin.overview.realms.useQuery();
  const balanced = oddsAddUp(odds);

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-headline text-label">Odds per card</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PACK_ODDS_FIELDS.map(([rarity, field]) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`pack-odds-${field}`}>{RARITY_LABELS[rarity]} (%)</Label>
              <Input
                id={`pack-odds-${field}`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={odds[field]}
                onChange={(event) => onOddsChange({ ...odds, [field]: Number(event.target.value) })}
                className="tabular-nums"
              />
            </div>
          ))}
        </div>
        <p
          aria-live="polite"
          className={
            balanced ? "text-footnote text-label-secondary" : "text-footnote text-destructive"
          }
        >
          {balanced
            ? "Odds add up to 100%"
            : `Odds add up to ${Number(packOddsTotal(odds).toFixed(2))}%. They must add up to 100%.`}
        </p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-headline text-label">Pool</legend>
        <div className="space-y-1">
          <Label htmlFor="pack-card-type">Card type</Label>
          <ValueSelect<CardTypeValue | "any">
            id="pack-card-type"
            value={cardType ?? "any"}
            onValueChange={(value) => onCardTypeChange(value === "any" ? null : value)}
            options={CARD_TYPE_OPTIONS}
          />
        </div>
        {season ? (
          <p className="text-footnote text-label-secondary">
            {`This pack draws only cards from season ${season}.`}
          </p>
        ) : null}
        {realms.data ? (
          <PoolToggles
            label="Realms"
            none="every realm"
            options={realms.data.map((realm) => [realm.id, realm.name] as const)}
            value={pool.realmIds}
            onChange={(realmIds) => onPoolChange({ ...pool, realmIds })}
          />
        ) : (
          <p className="text-footnote text-label-secondary">
            {realms.isError
              ? "The realms did not load. Reopen the pack to try again."
              : "Loading realms"}
          </p>
        )}
        <PoolToggles
          label="Types"
          none="every type"
          options={TYPE_OPTIONS}
          value={pool.cardTypes}
          onChange={(cardTypes) => onPoolChange({ ...pool, cardTypes })}
        />
        <PoolToggles
          label="Categories"
          none="every category"
          options={CATEGORY_OPTIONS}
          value={pool.categories}
          onChange={(categories) => onPoolChange({ ...pool, categories })}
        />
      </fieldset>

      <div className="space-y-3">
        {!preview.previewing && (
          <Button variant="secondary" disabled={!preview.oddsValid} onClick={preview.start}>
            Preview the pool
          </Button>
        )}
        {preview.previewing && preview.isError && (
          <p role="alert" className="text-footnote text-destructive">
            The pool preview did not load. Edit the pool or reopen the pack to try again.
          </p>
        )}
        {preview.previewing && !preview.data && preview.isFetching && (
          <p className="text-footnote text-label-secondary">Counting the pool</p>
        )}
        {preview.data && <PoolPreview preview={preview.data} guaranteedRarity={guaranteedRarity} />}
      </div>
    </div>
  );
}
