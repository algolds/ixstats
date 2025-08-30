import React from 'react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { 
  Command,
  Search,
  X,
  ChevronDown
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "../ui/tooltip";
import { SimpleFlag } from "../SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import type { SearchViewProps, SearchFilter } from './types';

export function SearchView({
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  countriesData,
  closeDropdown
}: SearchViewProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="text-xl font-bold text-foreground flex items-center gap-3 w-full justify-center">
          <Command className="h-6 w-6 text-blue-400" />
          <span>Command Palette</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={closeDropdown}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-2 py-2 absolute right-6 top-6"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'countries', 'commands', 'features'] as SearchFilter[]).map((filter) => (
          <Button
            key={filter}
            size="sm"
            variant={searchFilter === filter ? "default" : "ghost"}
            onClick={() => setSearchFilter && setSearchFilter(filter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${ 
              searchFilter === filter 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
            }`}
          >
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            {filter === 'countries' && countriesData?.countries && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4">
                {countriesData.countries.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder={`Search ${searchFilter === 'all' ? 'everything' : searchFilter}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
          className="pl-12 pr-16 py-3 bg-accent/10 border text-foreground placeholder:text-muted-foreground rounded-xl text-base focus:bg-accent/15 focus:border-blue-400 transition-all"
          data-command-palette-search="true"
          autoFocus
        />
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          <kbd className="hidden md:inline-flex px-2 py-1 text-xs bg-muted rounded border-border text-muted-foreground">
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
                      className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground hover:bg-accent/10 p-4 rounded-xl transition-all group h-auto"
                    >
                      <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg group-hover:bg-accent/15 transition-colors shrink-0">
                        {result.type === 'country' && result.metadata?.countryName ? (
                          <SimpleFlag 
                            countryName={result.metadata.countryName}
                            className="w-6 h-4 rounded object-cover"
                            showPlaceholder={true}
                          />
                        ) : (
                          result.icon && <result.icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium text-base text-foreground break-words">
                            {result.title}
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`px-2 py-0.5 text-[10px] h-5 ${ 
                              result.type === 'country' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                              result.type === 'command' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                              'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {result.type}
                          </Badge>
                        </div>
                        {result.subtitle && (
                          <div className="text-sm text-muted-foreground mb-1 break-words">
                            {result.subtitle}
                          </div>
                        )}
                        {result.description && (
                          <div className="text-xs text-muted-foreground/70 break-words">
                            {result.description}
                          </div>
                        )}
                      </div>
                      <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0">
                        <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-2">
                      <div className="font-medium">{result.title}</div>
                      {result.type === 'country' && result.metadata && (
                        <div className="text-sm space-y-1">
                          <div>Economic Tier: <span className="font-medium">{result.metadata.economicTier || 'Unknown'}</span></div>
                          <div>Population: <span className="font-medium">{formatPopulation(result.metadata.population || 0)}</span></div>
                          <div>GDP per Capita: <span className="font-medium">{formatCurrency(result.metadata.gdpPerCapita || 0)}</span></div>
                        </div>
                      )}
                      {result.type === 'command' && (
                        <div className="text-sm">
                          Navigate to the {result.title} page to access related features and tools.
                        </div>
                      )}
                      {result.type === 'feature' && (
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
          <div className="text-center py-8">
            <div className="p-4 bg-muted/30 rounded-2xl max-w-md mx-auto">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <div className="text-muted-foreground text-lg mb-2">No results found</div>
              <div className="text-muted-foreground/70 text-sm break-words">
                No {searchFilter === 'all' ? 'matches' : searchFilter} found for{' '}
                <span className="font-mono bg-muted px-2 py-1 rounded">"{debouncedSearchQuery}"</span>
              </div>
              <div className="text-muted-foreground/50 text-xs mt-3">
                {searchFilter === 'all' ? (
                  'Try searching for countries, commands, or features'
                ) : searchFilter === 'countries' ? (
                  `Try a different country name. We have ${countriesData?.countries?.length || 0} countries available.`
                ) : searchFilter === 'commands' ? (
                  'Try "dashboard", "countries", "mycountry", or other page names'
                ) : (
                  'Try "economic analysis", "strategic planning", or other feature names'
                )}
              </div>
              {searchFilter !== 'all' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchFilter?.('all')}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Search all categories instead
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="p-6 bg-gradient-to-b from-muted/30 to-muted/50 rounded-2xl max-w-md mx-auto">
              <Command className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <div className="text-foreground text-lg mb-3">
                Search {searchFilter === 'all' ? 'Everything' : (searchFilter || 'all').charAt(0).toUpperCase() + (searchFilter || 'all').slice(1)}
              </div>
              <div className="text-muted-foreground/70 text-sm mb-4">
                {searchFilter === 'all' ? (
                  'Find countries, navigate to pages, or discover features'
                ) : searchFilter === 'countries' ? (
                  `Search through ${countriesData?.countries?.length || 0} countries by name`
                ) : searchFilter === 'commands' ? (
                  'Navigate to different pages and sections'
                ) : (
                  'Discover tools and features across the platform'
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground/50">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded border-border">⌘</kbd>
                  <span>+</span>
                  <kbd className="px-2 py-1 bg-muted rounded border-border">K</kbd>
                  <span>to search</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded border-border">Tab</kbd>
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
