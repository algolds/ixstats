import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Command, Search, X, ChevronDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { SimpleFlag } from "../SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import type { SearchViewProps, SearchFilter } from "./types";

export function SearchView({
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  countriesData,
  closeDropdown,
}: SearchViewProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // EXTREMELY SIMPLE focus - just focus immediately when mounted
  useEffect(() => {
    console.log("[DynamicIsland SearchView] Component mounted");

    // Use a very short delay to ensure DOM is ready
    setTimeout(() => {
      if (searchInputRef.current) {
        console.log("[DynamicIsland SearchView] Focusing input now");
        searchInputRef.current.focus();

        // Verify focus worked
        setTimeout(() => {
          const focused = document.activeElement === searchInputRef.current;
          console.log("[DynamicIsland SearchView] Focus successful:", focused);
          if (!focused) {
            console.log(
              "[DynamicIsland SearchView] Focus failed, active element is:",
              document.activeElement
            );
          }
        }, 10);
      }
    }, 50);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-foreground flex w-full items-center justify-center gap-3 text-xl font-bold">
          <Command className="h-6 w-6 text-blue-400" />
          <span>Command Palette</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={closeDropdown}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10 absolute top-6 right-6 px-2 py-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Filter Tabs */}
      <div className="mb-4 flex items-center gap-2">
        {(["all", "countries", "commands", "features"] as SearchFilter[]).map((filter) => (
          <Button
            key={filter}
            size="sm"
            variant={searchFilter === filter ? "default" : "ghost"}
            onClick={() => setSearchFilter && setSearchFilter(filter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              searchFilter === filter
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            }`}
          >
            {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            {filter === "countries" && countriesData?.countries && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 py-0 text-[10px]">
                {countriesData.countries.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform" />
        <input
          ref={searchInputRef}
          type="text"
          tabIndex={0}
          placeholder={`Search ${searchFilter === "all" ? "everything" : searchFilter}...`}
          value={searchQuery || ""}
          onChange={(e) => {
            console.log("[DynamicIsland SearchView] onChange fired, value:", e.target.value);
            console.log(
              "[DynamicIsland SearchView] setSearchQuery function exists:",
              !!setSearchQuery
            );
            if (setSearchQuery) {
              console.log(
                "[DynamicIsland SearchView] Calling setSearchQuery with:",
                e.target.value
              );
              setSearchQuery(e.target.value);
            } else {
              console.error("[DynamicIsland SearchView] setSearchQuery is undefined!");
            }
          }}
          onKeyDown={(e) => {
            const input = e.target as HTMLInputElement;

            // Handle typing manually since onChange/onInput aren't working naturally
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
              if (e.key.length === 1) {
                // Regular character - insert at cursor position
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const currentValue = input.value;
                const newValue = currentValue.slice(0, start) + e.key + currentValue.slice(end);

                input.value = newValue;

                // Update cursor position
                const newCursor = start + 1;
                setTimeout(() => {
                  input.setSelectionRange(newCursor, newCursor);
                }, 0);

                // Trigger React onChange
                if (setSearchQuery) {
                  setSearchQuery(newValue);
                }

                e.preventDefault();
              } else if (e.key === "Backspace") {
                // Handle backspace
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const currentValue = input.value;

                let newValue: string;
                let newCursor: number;

                if (start !== end) {
                  // Delete selection
                  newValue = currentValue.slice(0, start) + currentValue.slice(end);
                  newCursor = start;
                } else if (start > 0) {
                  // Delete character before cursor
                  newValue = currentValue.slice(0, start - 1) + currentValue.slice(start);
                  newCursor = start - 1;
                } else {
                  return; // Nothing to delete
                }

                input.value = newValue;
                setTimeout(() => {
                  input.setSelectionRange(newCursor, newCursor);
                }, 0);

                if (setSearchQuery) {
                  setSearchQuery(newValue);
                }

                e.preventDefault();
              } else if (e.key === "Delete") {
                // Handle delete key
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const currentValue = input.value;

                let newValue: string;

                if (start !== end) {
                  // Delete selection
                  newValue = currentValue.slice(0, start) + currentValue.slice(end);
                } else if (start < currentValue.length) {
                  // Delete character after cursor
                  newValue = currentValue.slice(0, start) + currentValue.slice(start + 1);
                } else {
                  return; // Nothing to delete
                }

                input.value = newValue;
                setTimeout(() => {
                  input.setSelectionRange(start, start);
                }, 0);

                if (setSearchQuery) {
                  setSearchQuery(newValue);
                }

                e.preventDefault();
              }
            }
          }}
          onFocus={() => console.log("[DynamicIsland SearchView] Input focused")}
          onBlur={() => console.log("[DynamicIsland SearchView] Input blurred")}
          className="bg-accent/10 text-foreground placeholder:text-muted-foreground focus:bg-accent/15 w-full rounded-xl border py-3 pr-16 pl-12 text-base transition-all focus:border-blue-400"
          data-command-palette-search="true"
          autoFocus
        />
        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 transform items-center gap-2">
          <kbd className="bg-muted border-border text-muted-foreground hidden rounded px-2 py-1 text-xs md:inline-flex">
            ⌘K
          </kbd>
        </div>
      </div>

      <ScrollArea className="max-h-96">
        {searchResults && searchResults.length > 0 ? (
          <div className="space-y-3">
            {searchResults.map((result) => (
              <TooltipProvider key={result.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={result.action}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent/10 group h-auto w-full justify-start gap-4 rounded-xl p-4 transition-all"
                    >
                      <div className="bg-accent/10 group-hover:bg-accent/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                        {result.type === "country" && result.metadata?.countryName ? (
                          <SimpleFlag
                            countryName={result.metadata.countryName}
                            className="h-4 w-6 rounded object-cover"
                            showPlaceholder={true}
                          />
                        ) : (
                          result.icon && <result.icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="mb-1 flex items-center gap-2">
                          <div className="text-foreground text-base font-medium break-words">
                            {result.title}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`h-5 px-2 py-0.5 text-[10px] ${
                              result.type === "country"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : result.type === "command"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            }`}
                          >
                            {result.type}
                          </Badge>
                        </div>
                        {result.subtitle && (
                          <div className="text-muted-foreground mb-1 text-sm break-words">
                            {result.subtitle}
                          </div>
                        )}
                        {result.description && (
                          <div className="text-muted-foreground/70 text-xs break-words">
                            {result.description}
                          </div>
                        )}
                      </div>
                      <div className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors">
                        <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-2">
                      <div className="font-medium">{result.title}</div>
                      {result.type === "country" && result.metadata && (
                        <div className="space-y-1 text-sm">
                          <div>
                            Economic Tier:{" "}
                            <span className="font-medium">
                              {result.metadata.economicTier || "Unknown"}
                            </span>
                          </div>
                          <div>
                            Population:{" "}
                            <span className="font-medium">
                              {formatPopulation(result.metadata.population || 0)}
                            </span>
                          </div>
                          <div>
                            GDP per Capita:{" "}
                            <span className="font-medium">
                              {formatCurrency(result.metadata.gdpPerCapita || 0)}
                            </span>
                          </div>
                        </div>
                      )}
                      {result.type === "command" && (
                        <div className="text-sm">
                          Navigate to the {result.title} page to access related features and tools.
                        </div>
                      )}
                      {result.type === "feature" && (
                        <div className="text-sm">
                          {result.subtitle} Click to access this feature.
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        ) : debouncedSearchQuery ? (
          <div className="py-8 text-center">
            <div className="bg-muted/30 mx-auto max-w-md rounded-2xl p-4">
              <Search className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
              <div className="text-muted-foreground mb-2 text-lg">No results found</div>
              <div className="text-muted-foreground/70 text-sm break-words">
                No {searchFilter === "all" ? "matches" : searchFilter} found for{" "}
                <span className="bg-muted rounded px-2 py-1 font-mono">
                  "{debouncedSearchQuery}"
                </span>
              </div>
              <div className="text-muted-foreground/50 mt-3 text-xs">
                {searchFilter === "all"
                  ? "Try searching for countries, commands, or features"
                  : searchFilter === "countries"
                    ? `Try a different country name. We have ${countriesData?.countries?.length || 0} countries available.`
                    : searchFilter === "commands"
                      ? 'Try "dashboard", "countries", "mycountry", or other page names'
                      : 'Try "economic analysis", "strategic planning", or other feature names'}
              </div>
              {searchFilter !== "all" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchFilter?.("all")}
                  className="text-muted-foreground hover:text-foreground mt-2 text-xs"
                >
                  Search all categories instead
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="from-muted/30 to-muted/50 mx-auto max-w-md rounded-2xl bg-gradient-to-b p-6">
              <Command className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
              <div className="text-foreground mb-3 text-lg">
                Search{" "}
                {searchFilter === "all"
                  ? "Everything"
                  : (searchFilter || "all").charAt(0).toUpperCase() +
                    (searchFilter || "all").slice(1)}
              </div>
              <div className="text-muted-foreground/70 mb-4 text-sm">
                {searchFilter === "all"
                  ? "Find countries, navigate to pages, or discover features"
                  : searchFilter === "countries"
                    ? `Search through ${countriesData?.countries?.length || 0} countries by name`
                    : searchFilter === "commands"
                      ? "Navigate to different pages and sections"
                      : "Discover tools and features across the platform"}
              </div>
              <div className="text-muted-foreground/50 flex flex-wrap justify-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <kbd className="bg-muted border-border rounded px-2 py-1">⌘</kbd>
                  <span>+</span>
                  <kbd className="bg-muted border-border rounded px-2 py-1">K</kbd>
                  <span>to search</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <kbd className="bg-muted border-border rounded px-2 py-1">Tab</kbd>
                  <span>to cycle filters</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
