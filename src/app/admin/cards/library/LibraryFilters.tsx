"use client";
/** The Library's filters: a title search, realm, type, rarity, source wiki and what to show. */
import { api } from "~/trpc/react";
import type { CardWikiSource } from "~/lib/cards/card-sources";
import { Input } from "~/components/ui/input";
import { ValueSelect } from "~/components/ui/value-select";
import {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  RARITIES,
  RARITY_LABELS,
  SOURCE_OPTIONS,
  type CardTypeValue,
  type RarityValue,
} from "../shared/card-labels";

type Show = "all" | "retired" | "art_hidden" | "bound";

/** The form's choices; "any" filters nothing. */
export interface LibraryFilterState {
  search: string;
  realmId: string;
  cardType: CardTypeValue | "any";
  rarity: RarityValue | "any";
  source: CardWikiSource | "any";
  show: Show;
}

export const EMPTY_FILTER: LibraryFilterState = {
  search: "",
  realmId: "any",
  cardType: "any",
  rarity: "any",
  source: "any",
  show: "all",
};

const TYPE_OPTIONS: ReadonlyArray<readonly [CardTypeValue | "any", string]> = [
  ["any", "Every type"],
  ...CARD_TYPES.map((type) => [type, CARD_TYPE_LABELS[type]] as const),
];
const RARITY_OPTIONS: ReadonlyArray<readonly [RarityValue | "any", string]> = [
  ["any", "Every rarity"],
  ...RARITIES.map((rarity) => [rarity, RARITY_LABELS[rarity]] as const),
];
const SOURCE_FILTER: ReadonlyArray<readonly [CardWikiSource | "any", string]> = [
  ["any", "Every source"],
  ...SOURCE_OPTIONS,
];
const SHOW_OPTIONS: ReadonlyArray<readonly [Show, string]> = [
  ["all", "All cards"],
  ["retired", "Hidden"],
  ["art_hidden", "Art hidden"],
  ["bound", "Bound"],
];

export function LibraryFilters({
  value,
  onChange,
}: {
  value: LibraryFilterState;
  onChange: (next: LibraryFilterState) => void;
}) {
  const realms = api.cards.admin.overview.realms.useQuery();
  const set =
    <K extends keyof LibraryFilterState>(key: K) =>
    (next: LibraryFilterState[K]) =>
      onChange({ ...value, [key]: next });
  const realmOptions: ReadonlyArray<readonly [string, string]> = [
    ["any", "Every realm"],
    ...(realms.data ?? []).map((realm) => [realm.id, realm.name] as const),
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Input
        aria-label="Search titles"
        placeholder="Search titles"
        maxLength={100}
        value={value.search}
        onChange={(event) => set("search")(event.target.value)}
      />
      <ValueSelect
        aria-label="Realm"
        value={value.realmId}
        onValueChange={set("realmId")}
        options={realmOptions}
      />
      <ValueSelect
        aria-label="Type"
        value={value.cardType}
        onValueChange={set("cardType")}
        options={TYPE_OPTIONS}
      />
      <ValueSelect
        aria-label="Rarity"
        value={value.rarity}
        onValueChange={set("rarity")}
        options={RARITY_OPTIONS}
      />
      <ValueSelect
        aria-label="Source wiki"
        value={value.source}
        onValueChange={set("source")}
        options={SOURCE_FILTER}
      />
      <ValueSelect
        aria-label="Show"
        value={value.show}
        onValueChange={set("show")}
        options={SHOW_OPTIONS}
      />
    </div>
  );
}
