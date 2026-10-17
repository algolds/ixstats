"use client";
/**
 * The one wiki importer: a source and a category (or a whole wiki, or a list), which pages already have a card, and
 * a server-side import of the rest. Every card it makes waits in Curation.
 */
import { useState } from "react";
import { Download, Search } from "iconoir-react";
import { api } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { useNotify } from "~/hooks/useNotify";
import {
  categoryName,
  parseCardArticleSource,
  sourceCount,
  sourceNoun,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Textarea } from "~/components/ui/textarea";
import { ValueSelect } from "~/components/ui/value-select";
import { SOURCE_OPTIONS } from "../shared/card-labels";

type Mode = "category" | "all" | "titles";

interface Entry {
  title: string;
  carded: boolean;
}

/** What a crawl found, with the source and job label it was found under. */
interface Found {
  source: CardWikiSource;
  label: string;
  entries: Entry[];
}

const MODE_OPTIONS: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "category", label: "A category" },
  { value: "all", label: "The whole wiki" },
  { value: "titles", label: "A list" },
];

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function jobLabel(source: CardWikiSource, mode: Mode, category: string): string {
  if (mode === "category") return `Category:${category}`;
  return mode === "all" ? "Every page" : `Chosen ${sourceNoun(source, 2)}`;
}

/** The category field, with the wiki's matching categories and their page counts to pick from. */
function CategoryField({
  source,
  value,
  onChange,
}: {
  source: CardWikiSource;
  value: string;
  onChange: (value: string) => void;
}) {
  const prefix = useDebounce(categoryName(value), 300);
  // Commons has no category search here: its categories are typed.
  const wiki = parseCardArticleSource(source);
  const searching = wiki !== null && prefix.length >= 2;
  const suggestions = api.cards.admin.imports.searchCategories.useQuery(
    { source: wiki ?? "ixwiki", prefix, limit: 8 },
    { enabled: searching }
  );
  const names = searching ? (suggestions.data ?? []) : [];
  const counts = api.cards.admin.imports.categoryCounts.useQuery(
    { source: wiki ?? "ixwiki", categories: names },
    { enabled: names.length > 0 }
  );

  return (
    <div className="space-y-1">
      <Label htmlFor="import-category">Category</Label>
      <Input
        id="import-category"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {names.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {names.map((name) => {
            const pages = counts.data?.[name]?.pages;
            return (
              <Button key={name} size="xs" variant="secondary" onClick={() => onChange(name)}>
                {name}
                {pages !== undefined && (
                  <span className="text-label-secondary tabular-nums">
                    {pages.toLocaleString()}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const importableOf = (entries: readonly Entry[]) =>
  entries.filter((entry) => !entry.carded).map((entry) => entry.title);

/** The pages a crawl found, with the checked ones, and the one button that imports them. */
function FoundPages({
  found,
  selected,
  onSelect,
  importing,
  onImport,
}: {
  found: Found;
  selected: ReadonlySet<string>;
  onSelect: (selected: ReadonlySet<string>) => void;
  importing: boolean;
  onImport: () => void;
}) {
  const importable = importableOf(found.entries);
  const carded = found.entries.length - importable.length;
  const toggle = (title: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(title);
    else next.delete(title);
    onSelect(next);
  };

  if (found.entries.length === 0) {
    return (
      <p className="text-footnote text-label-secondary">No {sourceNoun(found.source, 2)} found.</p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-footnote text-label-secondary">
          {sourceCount(found.source, found.entries.length)} found · {carded.toLocaleString()}{" "}
          {carded === 1 ? "already has a card" : "already have a card"}
        </p>
        {importable.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onSelect(new Set(selected.size > 0 ? [] : importable))}
          >
            {selected.size > 0 ? "Clear selection" : "Select all with no card"}
          </Button>
        )}
      </div>
      <ul className="border-separator rounded-row max-h-96 overflow-y-auto border">
        {found.entries.map((entry) => (
          <li key={entry.title}>
            <label className="flex min-h-9 items-center gap-3 px-3 py-2">
              <Checkbox
                checked={selected.has(entry.title)}
                disabled={entry.carded}
                onCheckedChange={(checked) => toggle(entry.title, checked === true)}
              />
              <span className="text-callout text-label min-w-0 flex-1 truncate">{entry.title}</span>
              {entry.carded && <Badge>Has a card</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <Button disabled={selected.size === 0 || importing} onClick={onImport}>
        Import {sourceCount(found.source, selected.size)}
      </Button>
    </div>
  );
}

export function WikiImporter() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [source, setSource] = useState<CardWikiSource>("ixwiki");
  const [mode, setMode] = useState<Mode>("category");
  const [category, setCategory] = useState("");
  const [pasted, setPasted] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const crawl = api.cards.admin.imports.crawl.useMutation({
    onSuccess: (result, asked) => {
      setFound({
        source: asked.source,
        label: jobLabel(asked.source, asked.mode, asked.category ?? ""),
        entries: result.entries,
      });
      setSelected(new Set(importableOf(result.entries)));
      if (result.truncated) {
        notify.info(
          `Showing ${sourceCount(asked.source, result.entries.length)}`,
          "The ones with no card come first. Import them, then find again for the rest."
        );
      }
    },
    onError: (error) => notify.error("Could not read the wiki", error.message),
  });

  const start = api.cards.admin.imports.start.useMutation({
    onSuccess: (result, variables) => {
      notify.success(
        "Import queued",
        `${sourceCount(variables.source, result.queued)} will import in the background.`
      );
      setFound(null);
      void utils.cards.admin.imports.jobs.invalidate();
    },
    onError: (error) => notify.error("Import not started", error.message),
  });

  const chooseSource = (next: CardWikiSource) => {
    setSource(next);
    if (next === "commons" && mode === "all") setMode("category");
    setFound(null);
  };
  const chooseMode = (next: Mode) => {
    setMode(next);
    setFound(null);
  };

  const ready =
    mode === "all" || (mode === "category" ? categoryName(category) : pasted.trim()) !== "";

  const findPages = () =>
    crawl.mutate({
      source,
      mode,
      category: mode === "category" ? categoryName(category) : undefined,
      titles: mode === "titles" ? lines(pasted) : undefined,
    });

  return (
    <Card content="input">
      <CardHeader className="pt-5">
        <CardTitle icon={<Download />}>Import from a wiki</CardTitle>
        <CardDescription>New cards wait in Curation until an admin approves them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="import-source">Source</Label>
            <ValueSelect
              id="import-source"
              value={source}
              onValueChange={chooseSource}
              options={SOURCE_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <Label id="import-mode">{source === "commons" ? "Files" : "Pages"} from</Label>
            <SegmentedControl
              aria-labelledby="import-mode"
              value={mode}
              onValueChange={chooseMode}
              options={MODE_OPTIONS.filter(
                (option) => source !== "commons" || option.value !== "all"
              )}
            />
          </div>
        </div>

        {mode === "category" && (
          <CategoryField source={source} value={category} onChange={setCategory} />
        )}
        {mode === "titles" && (
          <div className="space-y-1">
            <Label htmlFor="import-titles">
              {source === "commons" ? "File names" : "Page titles"}, one per line
            </Label>
            <Textarea
              id="import-titles"
              rows={6}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
            />
          </div>
        )}

        <Button variant="secondary" onClick={findPages} disabled={!ready || crawl.isPending}>
          <Search className="size-4" />
          Find {sourceNoun(source, 2)}
        </Button>

        {found && (
          <FoundPages
            found={found}
            selected={selected}
            onSelect={setSelected}
            importing={start.isPending}
            onImport={() =>
              start.mutate({
                source: found.source,
                label: found.label,
                titles: importableOf(found.entries).filter((title) => selected.has(title)),
              })
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
