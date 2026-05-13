"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, Globe, MapPin, Hexagon, Landmark, X, Loader2, Sun, Moon, Settings } from "lucide-react";
import type { ProjectionMode } from "~/lib/map-config";
import { useDebounce } from "~/hooks/useDebounce";
import { useTheme } from "~/context/theme-context";
import { flagService } from "~/lib/flag-service";
import { api } from "~/trpc/react";
import { isStandaloneClient } from "~/lib/standalone-detection";

export interface SearchResult {
  type: string;
  id: string;
  name: string;
  countryId: string | null;
  centroidLng: number;
  centroidLat: number;
}

interface MapSearchOverlayProps {
  onSelectResult: (result: SearchResult) => void;
  projectionMode?: ProjectionMode;
  onProjectionChange?: (mode: ProjectionMode) => void;
}

const TYPE_META: Record<string, { icon: typeof Globe; label: string }> = {
  country: { icon: Globe, label: "Countries" },
  city: { icon: MapPin, label: "Cities" },
  subdivision: { icon: Hexagon, label: "Regions" },
  poi: { icon: Landmark, label: "Points of Interest" },
};

/** Tiny inline flag that resolves async via the unified flag service. */
function FlagIcon({ name }: { name: string }) {
  const [url, setUrl] = useState<string | null>(() => flagService.getCachedFlagUrl(name));

  useEffect(() => {
    if (url) return;
    let mounted = true;
    flagService.getFlagUrl(name).then((u) => { if (mounted) setUrl(u); });
    return () => { mounted = false; };
  }, [name, url]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="h-3.5 w-5 flex-shrink-0 rounded-[2px] border border-border object-cover"
    />
  );
}

export function MapSearchOverlay({ onSelectResult, projectionMode, onProjectionChange }: MapSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { effectiveTheme, toggleTheme } = useTheme();

  const debouncedQuery = useDebounce(query.trim(), 250);

  const { data: results, isLoading } = api.geo.searchFeatures.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length >= 2, staleTime: 30_000 }
  );

  // Group results by type
  const grouped = useMemo(() => {
    if (!results || results.length === 0) return [];
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      (groups[r.type] ??= []).push(r);
    }
    return Object.entries(groups);
  }, [results]);

  const flatResults = results ?? [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelectResult(result);
      setQuery("");
      setOpen(false);
      setSelectedIdx(-1);
      inputRef.current?.blur();
    },
    [onSelectResult]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSelectedIdx(-1);
        inputRef.current?.blur();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIdx >= 0 && flatResults[selectedIdx]) {
        e.preventDefault();
        handleSelect(flatResults[selectedIdx]);
      }
    },
    [flatResults, selectedIdx, handleSelect]
  );

  const showDropdown = open && debouncedQuery.length >= 2;
  const hasResults = grouped.length > 0;

  return (
    <div
      ref={containerRef}
      className={`absolute left-1/2 z-20 w-[calc(100vw-24px)] -translate-x-1/2 sm:w-96 ${
        isStandaloneClient() ? "top-16" : "top-3"
      }`}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSelectedIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search countries, cities, places..."
          className={`w-full rounded-xl bg-card py-2.5 pl-9 text-sm text-foreground shadow-lg outline-none ring-1 ring-border transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-400 ${query ? "pr-16" : "pr-9"}`}
        />
        {/* Settings gear */}
        <button
          onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
          className={`absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground ${query ? "right-8" : "right-2.5"}`}
          title="Map settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
              setSelectedIdx(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-card py-1 shadow-lg ring-1 ring-border">
          {isLoading && !hasResults && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {!isLoading && !hasResults && results !== undefined && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {grouped.map(([type, items]) => {
            const meta = TYPE_META[type] ?? { icon: Globe, label: type };
            const Icon = meta.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </div>
                {items.map((result) => {
                  const flatIdx = flatResults.indexOf(result);
                  const isHighlighted = flatIdx === selectedIdx;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        isHighlighted
                          ? "bg-blue-50 text-blue-700"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {result.type === "country" ? (
                        <FlagIcon name={result.name} />
                      ) : (
                        <Icon
                          className={`h-3.5 w-3.5 flex-shrink-0 ${
                            isHighlighted ? "text-blue-500" : "text-muted-foreground"
                          }`}
                        />
                      )}
                      <span className="truncate font-medium">{result.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="mt-1.5 rounded-xl bg-card p-3 shadow-lg ring-1 ring-border">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Theme</span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
            >
              {effectiveTheme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {effectiveTheme === "dark" ? "Light" : "Dark"}
            </button>
          </div>

          {/* Projection */}
          {onProjectionChange && (
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Projection</span>
              <div className="flex rounded-md bg-muted p-0.5">
                {(["globe", "mercator", "dynamic"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onProjectionChange(mode)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      projectionMode === mode
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "dynamic" ? "Auto" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
