"use client";

import React, { useState, useCallback } from 'react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Loader2, Search, Plus, X, ExternalLink } from 'lucide-react';
import { cn } from '~/lib/utils';
import { debounce } from 'lodash';

interface WikiPageSearchProps {
  selectedPages: string[];
  onPagesChange: (pages: string[]) => void;
  countryName: string;
}

interface SearchResult {
  title: string;
  snippet?: string;
}

export function WikiPageSearch({ selectedPages, onPagesChange, countryName }: WikiPageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const searchWikiPages = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      setShowResults(true);

      try {
        // Use MediaWiki API opensearch
        const params = new URLSearchParams({
          action: 'opensearch',
          search: query,
          limit: '10',
          namespace: '0', // Main namespace only
          format: 'json',
          formatversion: '2',
        });

        const response = await fetch(`https://ixwiki.com/api.php?${params.toString()}&origin=*`);
        const data = await response.json();

        // OpenSearch returns [query, [titles], [descriptions], [urls]]
        if (Array.isArray(data) && data.length >= 2) {
          const titles = data[1] as string[];
          const descriptions = (data[2] || []) as string[];

          const results: SearchResult[] = titles.map((title, i) => ({
            title,
            snippet: descriptions[i] || '',
          }));

          setSearchResults(results);
        }
      } catch (error) {
        console.error('[WikiPageSearch] Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchWikiPages(value);
  };

  const handleAddPage = (pageTitle: string) => {
    if (!selectedPages.includes(pageTitle)) {
      onPagesChange([...selectedPages, pageTitle]);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const handleRemovePage = (pageTitle: string) => {
    onPagesChange(selectedPages.filter(p => p !== pageTitle));
  };

  const handleManualAdd = () => {
    const trimmed = searchQuery.trim();
    if (trimmed && !selectedPages.includes(trimmed)) {
      onPagesChange([...selectedPages, trimmed]);
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={`Search for wiki pages (e.g., "List of ${countryName}", "Government of ${countryName}")...`}
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleManualAdd();
                }
              }}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleManualAdd}
            disabled={!searchQuery.trim()}
            title="Add custom page name"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleAddPage(result.title)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-start justify-between gap-2",
                      selectedPages.includes(result.title) && "opacity-50"
                    )}
                    disabled={selectedPages.includes(result.title)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{result.title}</div>
                      {result.snippet && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {result.snippet}
                        </div>
                      )}
                    </div>
                    {selectedPages.includes(result.title) ? (
                      <Badge variant="secondary" className="text-xs shrink-0">Added</Badge>
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 3 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found. Press Enter to add "{searchQuery}" manually.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected Pages */}
      {selectedPages.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Selected Pages ({selectedPages.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPages.map((page, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="group flex items-center gap-2 pr-1 hover:bg-destructive/20 transition-colors"
              >
                <a
                  href={`https://ixwiki.com/wiki/${encodeURIComponent(page)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{page}</span>
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
                <button
                  onClick={() => handleRemovePage(page)}
                  className="ml-1 rounded-sm hover:bg-destructive/50 p-0.5 transition-colors"
                  title="Remove page"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {selectedPages.length === 0 && (
        <div className="text-xs text-muted-foreground text-center p-4 bg-muted/20 rounded-lg">
          Search for wiki pages above or type a custom page name and press Enter to add it
        </div>
      )}
    </div>
  );
}
