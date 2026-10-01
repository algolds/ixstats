"use client";
// src/components/wiki-os/shared/SearchModal.tsx
// WikiOS Search Modal with incremental query debouncing and keyboard navigation.

import {
  useState,
  useEffect,
  useRef,
  useDeferredValue,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "iconoir-react";
import { cn } from "~/lib/utils";
import { navigateWithBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const deferredQuery = useDeferredValue(debouncedQuery);

  const { data: searchData } = api.wikios.advancedSearch.useQuery(
    { query: deferredQuery, limit: 8 },
    { enabled: open && deferredQuery.length >= 2, staleTime: 30_000 }
  );

  const items = searchData?.results ?? [];

  // Focus input on open
  useEffect(() => {
    if (open) {
      // oxlint-disable-next-line
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on results change
  useEffect(() => {
    // oxlint-disable-next-line
    setSelectedIndex(0);
    // oxlint-disable-next-line
  }, [items.length]);

  const navigate = useCallback(
    (title: string) => {
      onClose();
      navigateWithBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, router);
    },
    [router, onClose]
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) {
        navigate(items[selectedIndex].title);
      } else if (query.trim()) {
        onClose();
        navigateWithBasePath(`/wiki/search?q=${encodeURIComponent(query)}`, router);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        presentation="instant"
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[15vh] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Search articles</DialogTitle>
        {/* Input */}
        <div className="border-separator flex items-center gap-3 border-b px-4 py-3">
          <Search className="text-label-secondary size-4 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles..."
            aria-label="Search articles"
            className="text-body text-label placeholder:text-label-tertiary min-w-0 flex-1 bg-transparent outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded-control-sm border-separator bg-fill-4 text-caption text-label-secondary hidden shrink-0 border px-2 py-0.5 sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.length >= 2 && items.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((item, idx) => (
              <li key={item.title}>
                <button
                  className={cn(
                    "flex w-full flex-col px-4 py-3 text-left transition-colors",
                    idx === selectedIndex ? "bg-fill-4" : "hover:bg-fill-4"
                  )}
                  onClick={() => navigate(item.title)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  type="button"
                >
                  <span
                    className={cn(
                      "text-headline truncate",
                      idx === selectedIndex ? "text-label" : "text-label-secondary"
                    )}
                  >
                    {item.title}
                  </span>
                  {item.snippet && (
                    <span
                      className="text-footnote text-label-secondary [&_.searchmatch]:text-label mt-0.5 line-clamp-1 [&_.searchmatch]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: item.snippet }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && items.length === 0 && (
          <div className="text-body text-label-secondary px-4 py-6 text-center">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer */}
        {query.length >= 2 && (
          <div className="border-separator border-t px-4 py-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                onClose();
                navigateWithBasePath(`/wiki/search?q=${encodeURIComponent(query)}`, router);
              }}
              className="h-auto px-0"
            >
              Full search for &ldquo;{query}&rdquo; →
            </Button>
          </div>
        )}

        {query.length < 2 && (
          <div className="text-footnote text-label-secondary px-4 py-6 text-center">
            Type at least 2 characters to search
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
