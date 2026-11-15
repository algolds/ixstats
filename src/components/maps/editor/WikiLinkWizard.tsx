"use client";

/**
 * Inline wiki search + infobox importer for feature forms; renders inline to keep panels compact. A realm whose map
 * reads more than one wiki (Ixnay: Wiki, then IIWiki) gets the shared wiki picker; a wiki that cannot answer is listed
 * but disabled, and a search in it says why instead of "no pages".
 */

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
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { WikiSourcePicker, useWikiSource } from "~/components/wiki-os/shared/WikiSourcePicker";
import { createUrl } from "~/lib/utils/url-utils";
import { parseWikiSource, wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";
import { wikiReadErrorText } from "~/lib/wiki-os/wiki-source-availability";

interface WikiImportableFields {
  population?: number;
  coordinates?: [number, number];
  capital?: string;
  governmentType?: string;
  leaderName?: string;
  area?: number;
  elevation?: number;
  wikiPageTitle: string;
  wikiSource?: WikiSource | null;
}

interface WikiLinkWizardProps {
  /** Current wiki page title (if already linked) */
  value?: string;
  /** Stored wiki source of the current link (if known) */
  wikiSource?: WikiSource | string | null;
  /** Called when user selects or unlinks a wiki page */
  onChange: (pageTitle: string | undefined, wikiSource?: WikiSource | null) => void;
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
  const fields: WikiImportableFields = {
    wikiPageTitle,
    ...(infobox.wikiSource ? { wikiSource: infobox.wikiSource } : {}),
  };
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
  errorText,
  coordDistance,
  onImport,
}: {
  infobox: Infobox | undefined;
  isLoading: boolean;
  /** Why the page could not be read (its wiki is switched off or unreachable); null when it could. */
  errorText: string | null;
  coordDistance: number | null;
  onImport?: () => void;
}) {
  return (
    <Card className="p-2">
      {errorText && (
        <div className="text-destructive text-footnote py-1" role="alert">
          {errorText}
        </div>
      )}

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
  wiki,
  onSelect,
  onSkip,
}: {
  enabled: boolean;
  placeholder: string;
  /** The wiki to search; undefined searches the realm's wikis in order. */
  wiki: WikiSource | undefined;
  onSelect: (title: string, wiki: WikiSource | null) => void;
  onSkip: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  const realm = useMapRealm();

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = api.geoWiki.searchWikiPages.useQuery(
    { query: debouncedQuery, limit: 8, realm, wiki },
    { enabled: enabled && debouncedQuery.length >= 2, staleTime: 30_000, retry: false }
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
              onClick={() => onSelect(r.title, searchResults.wikiSource)}
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

      {searchError && debouncedQuery.length >= 2 && (
        <div className="text-destructive text-footnote mt-1" role="alert">
          {wikiReadErrorText(searchError, "The wiki search failed. Try again.")}
        </div>
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
  wikiSource,
  onChange,
  onImport,
  currentCoords,
  placeholder = "Search wiki pages...",
}: WikiLinkWizardProps) {
  const [isSearching, setIsSearching] = useState(!value);
  const [showInfobox, setShowInfobox] = useState(false);
  /** The wiki the linked page was found on in this session; falls back to the stored `wikiSource` prop, else the realm's wikis. */
  const [linkedWiki, setLinkedWiki] = useState<WikiSource | null>(() =>
    wikiSource ? parseWikiSource(wikiSource) : null
  );
  const [syncedWikiProp, setSyncedWikiProp] = useState(wikiSource);
  if (syncedWikiProp !== wikiSource) {
    setSyncedWikiProp(wikiSource);
    setLinkedWiki(wikiSource ? parseWikiSource(wikiSource) : null);
  }
  const effectiveWiki: WikiSource | undefined =
    linkedWiki ?? (wikiSource ? parseWikiSource(wikiSource) : undefined);
  const realm = useMapRealm();
  const realmWikis = api.geoWiki.wikiSources.useQuery({ realm }, { staleTime: 5 * 60_000 }).data;
  const choice = useWikiSource("country", realmWikis ?? []);

  // Infobox parse (fires when a page is linked); looked up on the wiki it was picked from, else the realm's wikis
  const {
    data: infobox,
    isLoading: infoboxLoading,
    error: infoboxError,
  } = api.geoWiki.parseWikiInfobox.useQuery(
    { pageTitle: value!, realm, wiki: effectiveWiki },
    { enabled: !!value && showInfobox, staleTime: 5 * 60_000, retry: false }
  );

  if (!value || isSearching) {
    return (
      <div className="space-y-2">
        {choice.options.length > 1 && (
          <WikiSourcePicker
            size="sm"
            value={choice.source}
            options={choice.options}
            onValueChange={choice.setSource}
          />
        )}
        <WikiSearch
          enabled={isSearching}
          placeholder={placeholder}
          wiki={realmWikis ? choice.source : undefined}
          onSelect={(title, wiki) => {
            onChange(title, wiki);
            setLinkedWiki(wiki);
            setIsSearching(false);
            setShowInfobox(true);
          }}
          onSkip={() => {
            setIsSearching(false);
            setLinkedWiki(null);
            onChange(undefined, null);
          }}
        />
      </div>
    );
  }

  const coordDistance =
    infobox?.coordinates && currentCoords
      ? Math.round(distanceKm(currentCoords, infobox.coordinates))
      : null;
  const openPageUrl = infobox?.pageUrl ?? wikiReaderPath(value, effectiveWiki ?? "ixwiki");

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
        {openPageUrl && (
          <a
            href={createUrl(openPageUrl)}
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
            onChange(undefined, null);
            setLinkedWiki(null);
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
          errorText={
            infoboxError ? wikiReadErrorText(infoboxError, "That page could not be read.") : null
          }
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
