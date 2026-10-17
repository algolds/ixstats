"use client";
/** The pack editor's odds and pool: odds per rarity with their total, the pool filter, and the pool preview. */
import { useId, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";
import { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import {
  PACK_ODDS_FIELDS,
  PackOddsSchema,
  oddsAddUp,
  packOddsTotal,
  type PackOdds,
} from "~/lib/cards/pack-odds";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  RARITY_LABELS,
  type CardTypeValue,
  type RarityValue,
} from "../shared/card-labels";

type Pool = RouterInputs["cards"]["admin"]["packs"]["save"]["pool"];
type Preview = RouterOutputs["cards"]["admin"]["packs"]["preview"];

const CATEGORY_OPTIONS = Object.values(LoreCategory).map(
  (category) => [category, getCategoryLabel(category)] as const
);
/** Special and Trophy cards never drop from packs, so the pool offers only the types that do. */
const TYPE_OPTIONS = CARD_TYPES.filter((type) => type !== "SPECIAL" && type !== "TROPHY").map(
  (type) => [type, CARD_TYPE_LABELS[type]] as const
);

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

/** What the pack's own type and season add to the pool, or null when it has neither. */
function packScopeNote(cardType: CardTypeValue | null, season: number | null): string | null {
  if (!cardType && !season) return null;
  const cards = cardType ? `${CARD_TYPE_LABELS[cardType]} cards` : "cards";
  return `This pack draws only ${cards}${season ? ` from season ${season}` : ""}.`;
}

function PoolPreview({
  preview,
  guaranteedRarity,
}: {
  preview: Preview;
  guaranteedRarity: RarityValue | null;
}) {
  const fallsBack = preview.byRarity.some((row) => row.fallsBack);
  // The guaranteed slot draws from its own tier, so a tier with no cards cannot honour it
  const guaranteeEmpty = preview.byRarity.some(
    (row) => row.rarity === guaranteedRarity && row.count === 0
  );
  return (
    <div className="space-y-2">
      <p className="text-footnote text-label-secondary">
        {preview.total.toLocaleString()} approved cards in the pool
      </p>
      <ul className="flex flex-wrap gap-2">
        {preview.byRarity.map((row) => (
          <li key={row.rarity}>
            <Badge variant={row.fallsBack ? "warning" : "default"}>
              {`${RARITY_LABELS[row.rarity]}: ${row.count.toLocaleString()}${row.fallsBack ? ", none to draw" : ""}`}
            </Badge>
          </li>
        ))}
      </ul>
      {fallsBack && (
        <p className="text-footnote text-label-secondary">
          A rarity with odds but no cards draws from the next rarity down that has cards, or up when
          none below do.
        </p>
      )}
      {guaranteeEmpty && guaranteedRarity && (
        <p className="text-footnote text-warning-ink">
          {`No ${RARITY_LABELS[guaranteedRarity]} cards are in this pool, so the guaranteed card draws another rarity.`}
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
  /** The pack's own type and season: read-only here, they narrow the preview. */
  cardType: CardTypeValue | null;
  season: number | null;
  guaranteedRarity: RarityValue | null;
}

export function PackPoolFields({
  odds,
  onOddsChange,
  pool,
  onPoolChange,
  cardType,
  season,
  guaranteedRarity,
}: PackPoolFieldsProps) {
  const [previewing, setPreviewing] = useState(false);
  const realms = api.cards.admin.overview.realms.useQuery();
  const oddsValid = PackOddsSchema.safeParse(odds).success;
  // Once asked for, the preview follows the edits; it waits while the odds are not valid.
  const preview = api.cards.admin.packs.preview.useQuery(
    { cardType, season, pool, odds },
    { enabled: previewing && oddsValid, placeholderData: keepPreviousData }
  );
  const balanced = oddsAddUp(odds);
  const scopeNote = packScopeNote(cardType, season);

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
        {scopeNote && <p className="text-footnote text-label-secondary">{scopeNote}</p>}
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
        {!previewing && (
          <Button variant="secondary" disabled={!oddsValid} onClick={() => setPreviewing(true)}>
            Preview the pool
          </Button>
        )}
        {previewing && preview.isError && (
          <p role="alert" className="text-footnote text-destructive">
            The pool preview did not load. Edit the pool or reopen the pack to try again.
          </p>
        )}
        {previewing && !preview.data && preview.isFetching && (
          <p className="text-footnote text-label-secondary">Counting the pool</p>
        )}
        {previewing && preview.data && (
          <PoolPreview preview={preview.data} guaranteedRarity={guaranteedRarity} />
        )}
      </div>
    </div>
  );
}
