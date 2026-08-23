"use client";

/**
 * WikiLinkWizard — Inline wiki search + infobox parser for city/POI forms.
 *
 * Replaces the plain "Wiki page title" text input with:
 * 1. Type-ahead search against IxWiki/IIWiki (opensearch)
 * 2. On selection: fetches + parses infobox, shows importable fields
 * 3. Auto-fill callback to populate the parent form
 *
 * Renders inline (not a modal) to keep the editor panel compact.
 */

import { useState, useRef, useCallback } from "react";
import { Search, Link as Link2, LinkSlash as Unlink, SystemRestart as Loader2, Check, OpenNewWindow as ExternalLink, WarningTriangle as AlertTriangle } from "iconoir-react";
import { useDebounce } from "~/hooks/useDebounce";
import { api } from "~/trpc/react";

export interface WikiImportableFields {
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

export function WikiLinkWizard({
  value,
  onChange,
  onImport,
  currentCoords,
  placeholder = "Search wiki pages...",
}: WikiLinkWizardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(!value);
  const [showInfobox, setShowInfobox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Wiki search
  const { data: searchResults, isLoading: searchLoading } = api.geoWiki.searchWikiPages.useQuery(
    { query: debouncedQuery, limit: 8 },
    { enabled: isSearching && debouncedQuery.length >= 2, staleTime: 30_000 }
  );

  // Infobox parse (fires when a page is linked)
  const { data: infobox, isLoading: infoboxLoading } = api.geoWiki.parseWikiInfobox.useQuery(
    { pageTitle: value! },
    { enabled: !!value && showInfobox, staleTime: 5 * 60_000 }
  );

  const handleSelect = useCallback(
    (title: string) => {
      onChange(title);
      setSearchQuery("");
      setIsSearching(false);
      setShowInfobox(true);
    },
    [onChange]
  );

  const handleUnlink = useCallback(() => {
    onChange(undefined);
    setSearchQuery("");
    setIsSearching(true);
    setShowInfobox(false);
  }, [onChange]);

  const handleImport = useCallback(() => {
    if (!infobox || !onImport || !value) return;

    const fields: WikiImportableFields = { wikiPageTitle: value };

    for (const f of infobox.fields) {
      const key = f.key.toLowerCase();
      if (
        (key === "population_estimate" ||
          key === "population_total" ||
          key === "population_census") &&
        typeof f.typedValue === "number"
      ) {
        fields.population = f.typedValue;
      }
      if (key === "area_km2" && typeof f.typedValue === "number") {
        fields.area = f.typedValue;
      }
      if (key === "elevation_m" && typeof f.typedValue === "number") {
        fields.elevation = f.typedValue;
      }
      if (key === "capital" && typeof f.typedValue === "string") {
        fields.capital = f.typedValue;
      }
      if (key === "government_type" && typeof f.typedValue === "string") {
        fields.governmentType = f.typedValue;
      }
      if ((key === "leader_name1" || key === "leader_name") && typeof f.typedValue === "string") {
        fields.leaderName = f.typedValue;
      }
    }

    if (infobox.coordinates) {
      fields.coordinates = infobox.coordinates as [number, number];
    }

    onImport(fields);
    setShowInfobox(false);
  }, [infobox, onImport, value]);

  // Coordinate distance warning
  const coordDistance = (() => {
    if (!infobox?.coordinates || !currentCoords) return null;
    const [lng1, lat1] = currentCoords;
    const [lng2, lat2] = infobox.coordinates;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  })();

  // Linked state — show linked page with unlink option
  if (value && !isSearching) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs dark:bg-emerald-950/30">
          <Link2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span className="flex-1 truncate font-medium text-emerald-700 dark:text-emerald-300">
            {value}
          </span>
          <button
            onClick={() => setShowInfobox((v) => !v)}
            className="rounded p-0.5 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            title="View infobox data"
          >
            <Search className="h-3 w-3" />
          </button>
          {infobox?.pageUrl && (
            <a
              href={infobox.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-0.5 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              title="Open on wiki"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={handleUnlink}
            className="rounded p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Unlink wiki page"
          >
            <Unlink className="h-3 w-3" />
          </button>
        </div>

        {/* Infobox preview + import */}
        {showInfobox && (
          <div className="border-border bg-muted/50 rounded-md border p-2">
            {infoboxLoading && (
              <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Parsing infobox...
              </div>
            )}

            {infobox && !infobox.hasInfobox && (
              <div className="text-muted-foreground py-1 text-xs">
                No infobox found on this page.
              </div>
            )}

            {infobox?.hasInfobox && (
              <>
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  {infobox.templateName}
                </div>
                <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                  {infobox.fields
                    .filter((f) => f.cleanValue && f.fieldType !== "unknown")
                    .slice(0, 12)
                    .map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted-foreground w-24 shrink-0 truncate">
                          {f.key}
                        </span>
                        <span className="text-foreground truncate">{f.cleanValue}</span>
                      </div>
                    ))}
                </div>

                {coordDistance !== null && coordDistance > 50 && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Wiki coords are {coordDistance.toLocaleString()} km from map position
                  </div>
                )}

                {onImport && (
                  <button
                    onClick={handleImport}
                    className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    <Check className="h-3 w-3" /> Import fields to form
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Search state
  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          className="border-border bg-background text-foreground w-full rounded-md border py-1.5 pr-2 pl-7 text-xs outline-none focus:ring-1 focus:ring-blue-400"
        />
        {searchLoading && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {/* Search results dropdown */}
      {searchResults && searchResults.results.length > 0 && searchQuery.length >= 2 && (
        <div className="border-border bg-card absolute top-full right-0 left-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-md border shadow-lg">
          {searchResults.results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r.title)}
              className="hover:bg-accent flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-xs transition-colors"
            >
              <Link2 className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
              <div className="min-w-0">
                <div className="text-foreground truncate font-medium">{r.title}</div>
                {r.description && (
                  <div className="text-muted-foreground truncate text-[10px]">{r.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {searchResults &&
        searchResults.results.length === 0 &&
        debouncedQuery.length >= 2 &&
        !searchLoading && (
          <div className="text-muted-foreground mt-1 text-[10px]">
            No wiki pages found for &ldquo;{debouncedQuery}&rdquo;
          </div>
        )}

      {/* Skip option */}
      {searchQuery.length === 0 && (
        <button
          onClick={() => {
            setIsSearching(false);
            onChange(undefined);
          }}
          className="text-muted-foreground hover:text-foreground mt-1 text-[10px]"
        >
          Skip wiki linking
        </button>
      )}
    </div>
  );
}
