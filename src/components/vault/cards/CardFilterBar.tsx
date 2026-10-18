"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, Filter } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { BROWSABLE_CATEGORIES, isValidLoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import { OWNED_FILTER_LABEL, OWNED_FILTERS } from "~/lib/cards/face/explore-options";
import { activeFilterCount, EMPTY_CARD_FILTERS, type CardFilters } from "~/lib/cards/face/filters";
import {
  FINISH_LABEL,
  FINISH_ORDER,
  RARITY_LABEL,
  RARITY_ORDER,
  TYPE_LABEL,
  TYPE_ORDER,
} from "~/lib/cards/face/labels";
import type { CardRealmBadge, CardType } from "~/lib/cards/face/types";

export type FilterDimension =
  "realm" | "rarity" | "finish" | "type" | "category" | "duplicates" | "owned" | "region";

/** A select's "no filter" choice: Radix gives an empty value no item, and no realm id or region name is this. */
const ANY = "__any";
/** The longest search the Mine and Explore queries take. */
const SEARCH_MAX = 100;

const OWNED_OPTIONS = OWNED_FILTERS.map((value) => ({ value, label: OWNED_FILTER_LABEL[value] }));
const CATEGORY_OPTIONS = BROWSABLE_CATEGORIES.map((category) => ({
  value: category,
  label: getCategoryLabel(category),
}));

type SetFilter = <K extends keyof CardFilters>(key: K, value: CardFilters[K]) => void;
interface Option {
  value: string;
  label: string;
}

function Toggles<T extends string>(props: {
  label: string;
  values: readonly T[];
  labels: Readonly<Record<T, string>>;
  picked: readonly T[];
  onChange: (next: T[]) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <p id={id} className="text-subhead font-medium">
        {props.label}
      </p>
      <ToggleGroup
        type="multiple"
        variant="pill"
        size="sm"
        aria-labelledby={id}
        value={[...props.picked]}
        // Back to the enum's own values, in its order, whatever order they were pressed in.
        onValueChange={(next) => props.onChange(props.values.filter((v) => next.includes(v)))}
      >
        {props.values.map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {props.labels[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function PickOne(props: {
  label: string;
  anyLabel: string;
  value: string | null;
  options: readonly Option[];
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{props.label}</Label>
      <Select
        value={props.value ?? ANY}
        onValueChange={(next) => props.onChange(next === ANY ? null : next)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{props.anyLabel}</SelectItem>
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The regions to offer: a region that is on stays listed, so it can be turned off after the list changes. */
function regionOptions(regions: readonly string[], current: string | null): Option[] {
  const listed = current && !regions.includes(current) ? [current, ...regions] : regions;
  return listed.map((region) => ({ value: region, label: region }));
}

/** The realms to offer: a chosen realm stays listed under the name it was offered with, so it can be turned off. */
function realmOptions(
  realms: readonly CardRealmBadge[],
  chosen: string | null,
  names: ReadonlyMap<string, string>
): Option[] {
  const options = realms.map((realm) => ({ value: realm.id, label: realm.name }));
  if (chosen === null || realms.some((realm) => realm.id === chosen)) return options;
  return [{ value: chosen, label: names.get(chosen) ?? "Unlisted realm" }, ...options];
}

/** Every realm name the bar has been offered, so a chosen realm that drops out of `realms` keeps its name. */
function useRealmNames(realms: readonly CardRealmBadge[]): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  if (realms.some((realm) => names.get(realm.id) !== realm.name)) {
    setNames(new Map([...names, ...realms.map((realm) => [realm.id, realm.name] as const)]));
  }
  return names;
}

/** How the region filter searches the server's regions, when the caller does. */
export interface RegionSearchOptions {
  /** Whether regions apply at all (the NationStates realm is picked); a search that matches nothing keeps its input. */
  available: boolean;
  /**
   * The search box's text. The caller owns it, so it outlives the popover and always matches the `regions` it
   * fetched for it.
   */
  term: string;
  /** Called on each keystroke; the caller debounces it and passes the matches as `regions`. */
  onSearch: (search: string) => void;
}

function RegionOption(props: { label: string; on: boolean; onSelect: () => void }) {
  return (
    <CommandItem value={props.label} aria-current={props.on || undefined} onSelect={props.onSelect}>
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.on && <Check aria-hidden className="text-tint" />}
    </CommandItem>
  );
}

/** The region filter as a search: the matches come from the caller, so the list is never filtered here. */
function RegionSearch(props: {
  value: string | null;
  regions: readonly string[];
  search: RegionSearchOptions;
  onChange: (region: string | null) => void;
}) {
  const { term } = props.search;
  return (
    <div className="space-y-2">
      {/* Shown for sight; cmdk names its input with its own label. */}
      <p aria-hidden="true" className="text-subhead font-medium">
        NationStates region
      </p>
      <Command
        label="NationStates region"
        shouldFilter={false}
        className="border-separator rounded-control border"
      >
        <CommandInput
          value={term}
          maxLength={SEARCH_MAX}
          placeholder="Search regions"
          onValueChange={props.search.onSearch}
        />
        <CommandList className="max-h-48 p-1">
          <RegionOption
            label="Any region"
            on={props.value === null}
            onSelect={() => props.onChange(null)}
          />
          {regionOptions(props.regions, props.value).map((option) => (
            <RegionOption
              key={option.value}
              label={option.label}
              on={option.value === props.value}
              onSelect={() => props.onChange(option.value)}
            />
          ))}
        </CommandList>
        {term.trim() !== "" && props.regions.length === 0 && (
          <p className="text-footnote text-label-secondary px-3 py-2">No regions match.</p>
        )}
      </Command>
    </div>
  );
}

/** The region filter: a search when the caller searches the server, else a select over `regions`. */
function RegionField(props: {
  value: string | null;
  regions: readonly string[];
  search?: RegionSearchOptions;
  onChange: (region: string | null) => void;
}) {
  const { value, regions, search } = props;
  // A region that is on always shows, so it can be turned off.
  const shown = value !== null || (search ? search.available : regions.length > 0);
  if (!shown) return null;
  if (search) {
    return (
      <RegionSearch value={value} regions={regions} search={search} onChange={props.onChange} />
    );
  }
  return (
    <PickOne
      label="NationStates region"
      anyLabel="Any region"
      value={value}
      options={regionOptions(regions, value)}
      onChange={props.onChange}
    />
  );
}

function DuplicatesSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>Duplicates only</Label>
      <Switch id={id} checked={on} onCheckedChange={onChange} />
    </div>
  );
}

function FilterFields(props: {
  filters: CardFilters;
  set: SetFilter;
  has: (dimension: FilterDimension) => boolean;
  types: readonly CardType[];
  realms: readonly CardRealmBadge[];
  realmNames: ReadonlyMap<string, string>;
  regions: readonly string[];
  regionSearch?: RegionSearchOptions;
}) {
  const { filters, set, has } = props;
  return (
    <>
      {has("owned") && (
        <SegmentedControl
          aria-label="Collected or missing"
          fullWidth
          value={filters.owned}
          onValueChange={(owned) => set("owned", owned)}
          options={OWNED_OPTIONS}
        />
      )}
      {has("realm") && (props.realms.length > 0 || filters.realmId !== null) && (
        <PickOne
          label="Realm"
          anyLabel="Every realm"
          value={filters.realmId}
          options={realmOptions(props.realms, filters.realmId, props.realmNames)}
          onChange={(realmId) => set("realmId", realmId)}
        />
      )}
      {has("rarity") && (
        <Toggles
          label="Rarity"
          values={RARITY_ORDER}
          labels={RARITY_LABEL}
          picked={filters.rarities}
          onChange={(rarities) => set("rarities", rarities)}
        />
      )}
      {has("finish") && (
        <Toggles
          label="Finish"
          values={FINISH_ORDER}
          labels={FINISH_LABEL}
          picked={filters.finishes}
          onChange={(finishes) => set("finishes", finishes)}
        />
      )}
      {has("type") && (
        <Toggles
          label="Type"
          values={props.types}
          labels={TYPE_LABEL}
          picked={filters.types}
          onChange={(types) => set("types", types)}
        />
      )}
      {has("category") && (
        <PickOne
          label="Category"
          anyLabel="Any category"
          value={filters.category}
          options={CATEGORY_OPTIONS}
          onChange={(value) => set("category", value && isValidLoreCategory(value) ? value : null)}
        />
      )}
      {has("region") && (
        <RegionField
          value={filters.region}
          regions={props.regions}
          search={props.regionSearch}
          onChange={(region) => set("region", region)}
        />
      )}
      {has("duplicates") && (
        <DuplicatesSwitch on={filters.duplicates} onChange={(on) => set("duplicates", on)} />
      )}
    </>
  );
}

interface CardFilterBarProps<S extends string> {
  filters: CardFilters;
  onChange: (next: CardFilters) => void;
  dimensions: readonly FilterDimension[];
  /** The type filter's choices; every type unless the tab holds fewer. */
  types?: readonly CardType[];
  realms: readonly CardRealmBadge[];
  regions?: readonly string[];
  /** Makes the region filter a search over the server's regions; without it, a select over `regions`. */
  regionSearch?: RegionSearchOptions;
  sort: S;
  sortOptions: ReadonlyArray<{ value: S; label: string }>;
  onSortChange: (sort: S) => void;
  /** Controls after the sort: a view switch, the select toggle. */
  trailing?: ReactNode;
}

/** Search, a filters popover, the sort and the tab's own controls, wrapping onto a second line on a phone. */
export function CardFilterBar<S extends string>(props: CardFilterBarProps<S>) {
  const { filters, onChange, sortOptions } = props;
  const set: SetFilter = (key, value) => onChange({ ...filters, [key]: value });
  const count = activeFilterCount(filters);
  const realmNames = useRealmNames(props.realms);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        aria-label="Search cards"
        placeholder="Search by title"
        maxLength={SEARCH_MAX}
        value={filters.search}
        onValueChange={(search) => set("search", search)}
        containerClassName="min-w-48 flex-1"
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" aria-label={count > 0 ? `Filters, ${count} on` : "Filters"}>
            <Filter />
            Filters
            {count > 0 && (
              <span className="bg-tint-fill text-tint text-caption min-w-5 rounded-full px-1 tabular-nums">
                {count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" aria-label="Filters" className="w-80 space-y-4">
          <FilterFields
            filters={filters}
            set={set}
            has={(dimension) => props.dimensions.includes(dimension)}
            types={props.types ?? TYPE_ORDER}
            realms={props.realms}
            realmNames={realmNames}
            regions={props.regions ?? []}
            regionSearch={props.regionSearch}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() => onChange({ ...EMPTY_CARD_FILTERS, search: filters.search })}
          >
            Clear filters
          </Button>
        </PopoverContent>
      </Popover>
      <Select
        value={props.sort}
        onValueChange={(value) => {
          const next = sortOptions.find((option) => option.value === value);
          if (next) props.onSortChange(next.value);
        }}
      >
        <SelectTrigger aria-label="Sort" className="w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.trailing}
    </div>
  );
}
