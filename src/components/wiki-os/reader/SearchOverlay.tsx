// src/components/wiki-os/reader/SearchOverlay.tsx
// Search autocomplete dropdown for WikiOS header search bar

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";

interface SearchOverlayProps {
  query: string;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function SearchOverlay({ query, onClose, inputRef }: SearchOverlayProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { data: results } = api.wikios.search.useQuery(
    { query, limit: 8 },
    { enabled: query.length >= 2, staleTime: 30_000 }
  );

  const items = useMemo(() => results ?? [], [results]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, inputRef]);

  const navigate = useCallback(
    (title: string) => {
      onClose();
      navigateWithBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, router);
    },
    [router, onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault();
        navigate(items[selectedIndex].title);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    const input = inputRef.current;
    input?.addEventListener("keydown", handleKeyDown);
    return () => input?.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, navigate, onClose, inputRef]);

  if (query.length < 2 || items.length === 0) return null;

  return (
    <div ref={overlayRef} className="wikios-search-overlay glass-hierarchy-child">
      <ul className="wikios-search-results">
        {items.map((item, idx) => (
          <li key={item.title}>
            <button
              className={`wikios-search-result ${idx === selectedIndex ? "wikios-search-result--active" : ""}`}
              onClick={() => navigate(item.title)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="wikios-search-result-title">{item.title}</span>
              {"snippet" in item && (item as { snippet?: string }).snippet && (
                <span className="wikios-search-result-snippet">
                  {(item as { snippet: string }).snippet}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="wikios-search-footer">
        <button
          className="wikios-search-footer-link"
          onClick={() => {
            onClose();
            navigateWithBasePath(`/wiki/search?q=${encodeURIComponent(query)}`, router);
          }}
        >
          Full search for &ldquo;{query}&rdquo;
        </button>
      </div>
    </div>
  );
}
