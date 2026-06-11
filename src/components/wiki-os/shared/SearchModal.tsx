// src/components/wiki-os/shared/SearchModal.tsx
// WikiOS Search Modal with incremental query debouncing and keyboard navigation.

"use client";

import {
  useState,
  useEffect,
  useRef,
  useDeferredValue,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "~/lib/utils";
import { navigateWithBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

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
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Global Cmd+K listener
  useEffect(() => {
    const handleGlobal = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, [open, onClose]);

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
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--wikios-text-dim)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--wikios-text)] outline-none placeholder:text-[var(--wikios-text-dim)]"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--wikios-text-dim)] sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.length >= 2 && items.length > 0 && (
          <ul className="max-h-80 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent overflow-y-auto py-1">
            {items.map((item, idx) => (
              <li key={item.title}>
                <button
                  className={cn(
                    "flex w-full flex-col px-4 py-2.5 text-left transition-colors",
                    idx === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                  )}
                  onClick={() => navigate(item.title)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  type="button"
                >
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      idx === selectedIndex
                        ? "text-[var(--wikios-text)]"
                        : "text-[var(--wikios-text-muted)]"
                    )}
                  >
                    {item.title}
                  </span>
                  {item.snippet && (
                    <span
                      className="mt-0.5 line-clamp-1 text-[11px] text-[var(--wikios-text-dim)] [&_.searchmatch]:font-semibold [&_.searchmatch]:text-[var(--wikios-text)]"
                      dangerouslySetInnerHTML={{ __html: item.snippet }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && items.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[var(--wikios-text-dim)]">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer */}
        {query.length >= 2 && (
          <div className="border-t border-white/10 px-4 py-2">
            <button
              className="text-xs text-[var(--wikios-text-dim)] transition-colors hover:text-[var(--wikios-text-muted)]"
              onClick={() => {
                onClose();
                navigateWithBasePath(`/wiki/search?q=${encodeURIComponent(query)}`, router);
              }}
              type="button"
            >
              Full search for &ldquo;{query}&rdquo; →
            </button>
          </div>
        )}

        {query.length < 2 && (
          <div className="px-4 py-6 text-center text-xs text-[var(--wikios-text-dim)]">
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
