"use client";

import { useEffect, useRef, useState } from "react";
import { NavArrowLeft } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { assetUrl } from "~/lib/base-path";
import { getGovernmentForm } from "~/lib/government/forms";
import {
  foundImportFields,
  type ImportFieldId,
  type ImportedNation,
  type WikiSiteId,
} from "../lib/founding-draft";
import { IMPORT_FIELD_LABELS, readInfobox } from "../lib/founding-import";
import { formatMoney, formatPeople } from "../lib/founding-format";

const SITES: Array<{ value: WikiSiteId; label: string }> = [
  { value: "iiwiki", label: "IIWiki" },
  { value: "althistory", label: "AltHistory" },
];

/** Search waits this long after the last keystroke. */
const SEARCH_DEBOUNCE_MS = 250;

interface SearchHit {
  title: string;
  snippet?: string;
}

function fieldValue(nation: ImportedNation, id: ImportFieldId) {
  switch (id) {
    case "flagUrl":
      return (
        <img
          src={assetUrl(nation.flagUrl) ?? undefined}
          referrerPolicy="no-referrer"
          alt=""
          className="border-separator rounded-control-sm h-8 w-12 border object-cover"
        />
      );
    case "population":
      return `${formatPeople(nation.population!)} people`;
    case "gdpPerCapita":
      return `${formatMoney(nation.gdpPerCapita!)} per person`;
    case "government":
      return `${getGovernmentForm(nation.government!.formId)?.name ?? ""}, from "${nation.government!.raw}"`;
    default:
      return nation[id] as string;
  }
}

/** The review card: each field the page had, with a checkbox to keep it. */
export function ImportReview({
  nation,
  keep,
  onToggle,
}: {
  nation: ImportedNation;
  keep: ReadonlySet<ImportFieldId>;
  onToggle: (id: ImportFieldId) => void;
}) {
  const fields = foundImportFields(nation);
  if (fields.length === 0) {
    return (
      <Signal tone="warning" title="Nothing to import">
        This page has no infobox the builder can read. Try another page.
      </Signal>
    );
  }
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-subhead text-label-secondary pb-2">
        Found on {nation.title}. Untick anything you do not want.
      </legend>
      <ul className="flex flex-col">
        {fields.map((id) => {
          const inputId = `founding-import-${id}`;
          return (
            <li
              key={id}
              className="border-separator flex min-h-11 items-center gap-3 border-b py-2"
            >
              <Checkbox id={inputId} checked={keep.has(id)} onCheckedChange={() => onToggle(id)} />
              <Label htmlFor={inputId} className="text-body flex min-w-0 flex-1 flex-col gap-0.5">
                <span>{IMPORT_FIELD_LABELS[id]}</span>
                <span className="text-footnote text-label-secondary font-normal break-words">
                  {fieldValue(nation, id)}
                </span>
              </Label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

interface ImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (nation: ImportedNation, keep: ReadonlySet<ImportFieldId>) => void;
}

/** "Import from the wiki": search a wiki, read a page's infobox, and keep the fields you want. */
export function ImportSheet({ open, onOpenChange, onApply }: ImportSheetProps) {
  const [site, setSite] = useState<WikiSiteId>("iiwiki");
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nation, setNation] = useState<ImportedNation | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [keep, setKeep] = useState<Set<ImportFieldId>>(new Set());
  const { mutateAsync: searchWiki } = api.countries.searchWiki.useMutation();
  const { mutateAsync: parseInfobox } = api.countries.parseInfobox.useMutation();
  const requestId = useRef(0);

  useEffect(() => {
    const query = term.trim();
    if (!query) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      searchWiki({ query, site, categoryFilter: "Countries" })
        .then((results) => {
          if (id === requestId.current) setHits(results as SearchHit[]);
        })
        .catch((searchError: unknown) => {
          if (id !== requestId.current) return;
          setHits([]);
          setError(searchError instanceof Error ? searchError.message : "The wiki did not answer.");
        })
        .finally(() => {
          if (id === requestId.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, site, searchWiki]);

  async function pick(title: string) {
    setReading(title);
    setError(null);
    try {
      const infobox = await parseInfobox({ pageName: title, site });
      if (!infobox) {
        setError("That page has no infobox the builder can read. Try another page.");
        return;
      }
      const read = readInfobox(infobox as Record<string, unknown>, site, title);
      setNation(read);
      setKeep(new Set(foundImportFields(read)));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "The page could not be read.");
    } finally {
      setReading(null);
    }
  }

  function reset() {
    setNation(null);
    setKeep(new Set());
    setError(null);
  }

  const query = term.trim();
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent className="flex flex-col gap-5 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import from the wiki</SheetTitle>
          <SheetDescription>
            Bring in a nation you have already written about. You choose what to keep.
          </SheetDescription>
        </SheetHeader>

        {nation ? (
          <>
            <ImportReview
              nation={nation}
              keep={keep}
              onToggle={(id) =>
                setKeep((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
            <SheetFooter className="gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                <NavArrowLeft aria-hidden />
                Back to search
              </Button>
              <Button
                type="button"
                disabled={keep.size === 0}
                onClick={() => {
                  onApply(nation, keep);
                  reset();
                }}
              >
                Use these details
              </Button>
            </SheetFooter>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <SegmentedControl
              aria-label="Wiki"
              value={site}
              onValueChange={(next) => {
                setSite(next);
                setHits([]);
              }}
              options={SITES}
              fullWidth
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="founding-import-search" className="text-subhead">
                Nation page
              </Label>
              <Input
                id="founding-import-search"
                type="search"
                value={term}
                autoComplete="off"
                placeholder="Search by name"
                onChange={(event) => {
                  setTerm(event.target.value);
                  if (!event.target.value.trim()) setHits([]);
                }}
              />
            </div>
            {error && (
              <Signal tone="destructive" title="Could not search the wiki">
                {error}
              </Signal>
            )}
            <div aria-live="polite" className="sr-only">
              {query && !searching ? `${hits.length} pages found` : ""}
            </div>
            {searching ? (
              <div className="flex flex-col gap-2" role="status" aria-label="Searching">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            ) : query && hits.length === 0 && !error ? (
              <p className="text-callout text-label-secondary">
                No nation pages match. Check the spelling or try the other wiki.
              </p>
            ) : hits.length > 0 ? (
              <FacetList>
                <FacetListSection aria-label="Nation pages">
                  {hits.map((hit) => (
                    <FacetRow
                      key={hit.title}
                      title={hit.title}
                      subtitle={reading === hit.title ? "Reading the page…" : undefined}
                      accessory="chevron"
                      disabled={reading !== null}
                      onClick={() => void pick(hit.title)}
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
