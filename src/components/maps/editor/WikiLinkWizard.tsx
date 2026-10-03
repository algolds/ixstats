"use client";

/** Inline wiki search + infobox importer for feature forms; renders inline to keep panels compact. */

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import {
  Search,
  Link as Link2,
  LinkSlash as Unlink,
  SystemRestart as Loader2,
  Check,
  OpenNewWindow as ExternalLink,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { useDebounce } from "~/hooks/useDebounce";
import { api, type RouterOutputs } from "~/trpc/react";
import { distanceKm } from "~/lib/maps/geo-math";
import { Card } from "~/components/ui/card";

interface WikiImportableFields {
  population?: number;
  coordinates?: [number, number];
  capital?: string;
  governmentType?: string;
  leaderName?: string;
  area?: number;
  elevation?: number;
  wikiPageTitle: string;
}

interface WikiLinkWizardProps {
  /** Current wiki page title (if already linked) */
  value?: string;
  /** Called when user selects a wiki page */
  onChange: (pageTitle: string | undefined) => void;
  /** Called when user wants to import parsed fields */
  onImport?: (fields: WikiImportableFields) => void;
  /** Current map coordinates for conflict detection */
  currentCoords?: [number, number];
  /** Placeholder text */
  placeholder?: string;
}

type Infobox = RouterOutputs["geoWiki"]["parseWikiInfobox"];

type NumberField = "population" | "area" | "elevation";
type StringField = "capital" | "governmentType" | "leaderName";

/** Infobox keys (lowercase) that map onto importable form fields; later fields win. */
const NUMBER_IMPORTS: Record<NumberField, string[]> = {
  population: ["population_estimate", "population_total", "population_census"],
  area: ["area_km2"],
  elevation: ["elevation_m"],
};
const STRING_IMPORTS: Record<StringField, string[]> = {
  capital: ["capital"],
  governmentType: ["government_type"],
  leaderName: ["leader_name1", "leader_name"],
};

function toImportableFields(infobox: Infobox, wikiPageTitle: string): WikiImportableFields {
  const fields: WikiImportableFields = { wikiPageTitle };
  for (const f of infobox.fields) {
    const key = f.key.toLowerCase();
    for (const [field, keys] of Object.entries(NUMBER_IMPORTS)) {
      if (keys.includes(key) && typeof f.typedValue === "number") {
        fields[field as NumberField] = f.typedValue;
      }
    }
    for (const [field, keys] of Object.entries(STRING_IMPORTS)) {
      if (keys.includes(key) && typeof f.typedValue === "string") {
        fields[field as StringField] = f.typedValue;
      }
    }
  }
  if (infobox.coordinates) fields.coordinates = infobox.coordinates as [number, number];
  return fields;
}

function InfoboxCard({
  infobox,
  isLoading,
  coordDistance,
  onImport,
}: {
  infobox: Infobox | undefined;
  isLoading: boolean;
  coordDistance: number | null;
  onImport?: () => void;
}) {
  return (
    <Card className="p-2">
      {isLoading && (
        <div className="text-label-secondary text-footnote flex items-center gap-2 py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Parsing infobox...
        </div>
      )}

      {infobox && !infobox.hasInfobox && (
        <div className="text-label-secondary text-footnote py-1">
          No infobox found on this page.
        </div>
      )}

      {infobox?.hasInfobox && (
        <>
          <Eyebrow className="block">{infobox.templateName}</Eyebrow>
          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
            {infobox.fields
              .filter((f) => f.cleanValue && f.fieldType !== "unknown")
              .slice(0, 12)
              .map((f, i) => (
                <div key={i} className="text-footnote flex items-center gap-2">
                  <span className="text-label-secondary w-24 shrink-0 truncate">{f.key}</span>
                  <span className="text-label truncate">{f.cleanValue}</span>
                </div>
              ))}
          </div>

          {coordDistance !== null && coordDistance > 50 && (
            <div className="text-footnote text-yellow mt-2 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Wiki coords are {coordDistance.toLocaleString()} km from map position
            </div>
          )}

          {onImport && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-center"
              onClick={onImport}
            >
              <Check className="h-3 w-3" /> Import fields to form
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function WikiSearch({
  enabled,
  placeholder,
  onSelect,
  onSkip,
}: {
  enabled: boolean;
  placeholder: string;
  onSelect: (title: string) => void;
  onSkip: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: searchResults, isLoading: searchLoading } = api.geoWiki.searchWikiPages.useQuery(
    { query: debouncedQuery, limit: 8 },
    { enabled: enabled && debouncedQuery.length >= 2, staleTime: 30_000 }
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          className="border-separator bg-surface text-label rounded-control-sm text-footnote focus:ring-blue/50 w-full border py-2 pr-2 pl-7 outline-none focus:ring-1"
        />
        {searchLoading && (
          <Loader2 className="text-label-secondary absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {searchResults && searchResults.results.length > 0 && searchQuery.length >= 2 && (
        <Card className="absolute top-full right-0 left-0 z-20 mt-1 max-h-40 overflow-y-auto">
          {searchResults.results.map((r, i) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              key={i}
              onClick={() => onSelect(r.title)}
              className="h-auto min-h-(--control-height-sm) w-full justify-start gap-2 py-2 text-left whitespace-normal"
            >
              <Link2 className="text-label-secondary mt-0.5 h-3 w-3 shrink-0" />
              <div className="min-w-0">
                <div className="text-label truncate font-medium">{r.title}</div>
                {r.description && (
                  <div className="text-label-secondary text-footnote truncate">{r.description}</div>
                )}
              </div>
            </Button>
          ))}
        </Card>
      )}

      {searchResults &&
        searchResults.results.length === 0 &&
        debouncedQuery.length >= 2 &&
        !searchLoading && (
          <div className="text-label-secondary text-footnote mt-1">
            No wiki pages found for &ldquo;{debouncedQuery}&rdquo;
          </div>
        )}

      {searchQuery.length === 0 && (
        <Button variant="ghost" size="sm" className="text-label-secondary mt-1" onClick={onSkip}>
          Skip wiki linking
        </Button>
      )}
    </div>
  );
}

export function WikiLinkWizard({
  value,
  onChange,
  onImport,
  currentCoords,
  placeholder = "Search wiki pages...",
}: WikiLinkWizardProps) {
  const [isSearching, setIsSearching] = useState(!value);
  const [showInfobox, setShowInfobox] = useState(false);

  // Infobox parse (fires when a page is linked)
  const { data: infobox, isLoading: infoboxLoading } = api.geoWiki.parseWikiInfobox.useQuery(
    { pageTitle: value! },
    { enabled: !!value && showInfobox, staleTime: 5 * 60_000 }
  );

  if (!value || isSearching) {
    return (
      <WikiSearch
        enabled={isSearching}
        placeholder={placeholder}
        onSelect={(title) => {
          onChange(title);
          setIsSearching(false);
          setShowInfobox(true);
        }}
        onSkip={() => {
          setIsSearching(false);
          onChange(undefined);
        }}
      />
    );
  }

  const coordDistance =
    infobox?.coordinates && currentCoords
      ? Math.round(distanceKm(currentCoords, infobox.coordinates))
      : null;

  return (
    <div className="space-y-2">
      <div className="border-separator rounded-control-sm text-footnote flex items-center gap-2 border px-3 py-2">
        <Link2 className="text-green h-3 w-3" aria-hidden />
        <span className="text-label flex-1 truncate font-medium">{value}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowInfobox((v) => !v)}
          title="View infobox data"
        >
          <Search className="h-3 w-3" />
        </Button>
        {infobox?.pageUrl && (
          <a
            href={infobox.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-secondary hover:bg-fill-3 hover:text-label rounded-control-sm p-0.5"
            title="Open on wiki"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6"
          onClick={() => {
            onChange(undefined);
            setIsSearching(true);
            setShowInfobox(false);
          }}
          title="Unlink wiki page"
        >
          <Unlink className="h-3 w-3" />
        </Button>
      </div>

      {showInfobox && (
        <InfoboxCard
          infobox={infobox}
          isLoading={infoboxLoading}
          coordDistance={coordDistance}
          onImport={
            infobox && onImport
              ? () => {
                  onImport(toImportableFields(infobox, value));
                  setShowInfobox(false);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
