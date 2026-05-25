// src/components/wikios/editor/ImageSearchGrid.tsx
// Visual image search with glass-physics cards — IxWiki + Wikimedia Commons.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Loader2,
  X,
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon,
  Globe,
  Database,
  ZoomIn,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface ImageResult {
  title: string;
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  mime?: string;
}

type Tab = "ixwiki" | "commons";

interface ImageSearchGridProps {
  onSelect?: (image: ImageResult) => void;
  selectedImage?: ImageResult | null;
  compact?: boolean;
}

export function ImageSearchGrid({ onSelect, selectedImage, compact }: ImageSearchGridProps) {
  const [tab, setTab] = useState<Tab>("ixwiki");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<ImageResult | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleSearch = useCallback((val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 400);
  }, []);

  const ixwikiQuery = api.wiki.searchFiles.useQuery(
    { query: debouncedQuery, limit: 48 },
    { enabled: tab === "ixwiki" && debouncedQuery.length >= 2, staleTime: 60000 }
  );

  const commonsQuery = api.thinkpages.searchWikiCommonsImages.useQuery(
    { query: debouncedQuery, limit: 36 },
    { enabled: tab === "commons" && debouncedQuery.length >= 2, staleTime: 60000 }
  );

  const results: ImageResult[] =
    tab === "ixwiki"
      ? (ixwikiQuery.data ?? []).map((f: any) => ({
          title: f.title ?? f.name ?? "",
          url:
            f.url ??
            `https://ixwiki.com/wiki/Special:FilePath/${encodeURIComponent(f.title ?? f.name ?? "")}`,
          thumbUrl: f.thumbUrl ?? f.url,
          width: f.width,
          height: f.height,
          mime: f.mime,
        }))
      : (commonsQuery.data ?? []).map((f: any) => ({
          title: f.title ?? "",
          url: f.url ?? "",
          thumbUrl: f.thumbUrl ?? f.url,
          width: f.width,
          height: f.height,
          mime: f.mime,
        }));

  const isLoading = tab === "ixwiki" ? ixwikiQuery.isLoading : commonsQuery.isLoading;

  const handleCopy = useCallback((img: ImageResult) => {
    const name = img.title.replace(/^File:/, "");
    navigator.clipboard.writeText(`[[File:${name}|thumb|Caption]]`);
    setCopiedId(img.url);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return (
    <div className={cn("wikios-imgs", compact && "wikios-imgs-compact")}>
      {/* Header bar — tabs + search in one row */}
      <div className="wikios-imgs-header">
        <div className="wikios-imgs-tabs">
          <button
            onClick={() => {
              setTab("ixwiki");
              setExpandedImage(null);
            }}
            className={cn("wikios-imgs-tab", tab === "ixwiki" && "wikios-imgs-tab-active")}
          >
            <Database size={13} /> IxWiki
          </button>
          <button
            onClick={() => {
              setTab("commons");
              setExpandedImage(null);
            }}
            className={cn("wikios-imgs-tab", tab === "commons" && "wikios-imgs-tab-active")}
          >
            <Globe size={13} /> Commons
          </button>
        </div>
        <div className="wikios-imgs-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={
              tab === "ixwiki" ? "Search IxWiki files..." : "Search Wikimedia Commons..."
            }
            className="wikios-imgs-search-input"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
              className="wikios-imgs-search-clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Status line */}
      {debouncedQuery.length >= 2 && !isLoading && results.length > 0 && (
        <div className="wikios-imgs-status">
          {results.length} {results.length === 1 ? "image" : "images"} found
          {tab === "ixwiki" ? " on IxWiki" : " on Wikimedia Commons"}
        </div>
      )}

      {/* States */}
      {isLoading && debouncedQuery.length >= 2 && (
        <div className="wikios-imgs-state">
          <Loader2 size={24} className="animate-spin" />
          <span>Searching {tab === "ixwiki" ? "IxWiki" : "Wikimedia Commons"}...</span>
        </div>
      )}

      {debouncedQuery.length < 2 && (
        <div className="wikios-imgs-state wikios-imgs-empty-state">
          <div className="wikios-imgs-empty-icon">
            <ImageIcon size={36} />
          </div>
          <h3>Search for images</h3>
          <p>
            Find images from{" "}
            {tab === "ixwiki" ? "IxWiki's local uploads" : "Wikimedia Commons' free media library"}
          </p>
        </div>
      )}

      {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
        <div className="wikios-imgs-state">
          <ImageIcon size={24} className="opacity-30" />
          <span>No images found for &ldquo;{debouncedQuery}&rdquo;</span>
        </div>
      )}

      {/* Main content — grid + optional detail panel */}
      <div className="wikios-imgs-content">
        <div
          className={cn(
            "wikios-imgs-grid",
            compact ? "wikios-imgs-grid-sm" : "wikios-imgs-grid-lg"
          )}
        >
          {results.map((img) => {
            const isSelected = selectedImage?.url === img.url;
            const isExpanded = expandedImage?.url === img.url;
            return (
              <div
                key={img.title + img.url}
                className={cn(
                  "wikios-imgs-card",
                  isSelected && "wikios-imgs-card-selected",
                  isExpanded && "wikios-imgs-card-expanded"
                )}
                onClick={() => {
                  onSelect?.(img);
                  if (!compact) setExpandedImage(isExpanded ? null : img);
                }}
              >
                <div className="wikios-imgs-card-img">
                  <img
                    src={img.thumbUrl ?? img.url}
                    alt={img.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="wikios-imgs-card-overlay">
                    <ZoomIn size={16} />
                  </div>
                </div>
                <div className="wikios-imgs-card-footer">
                  <span className="wikios-imgs-card-name">
                    {img.title.replace(/^File:/, "").replace(/_/g, " ")}
                  </span>
                  <div className="wikios-imgs-card-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(img);
                      }}
                      className="wikios-imgs-card-btn"
                      title="Copy wikitext"
                    >
                      {copiedId === img.url ? (
                        <Check size={11} className="text-green-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="wikios-imgs-card-btn"
                      title="Open full size"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel — shows when an image is expanded (standalone page only) */}
        {!compact && expandedImage && (
          <div className="wikios-imgs-detail">
            <button onClick={() => setExpandedImage(null)} className="wikios-imgs-detail-close">
              <X size={14} />
            </button>
            <div className="wikios-imgs-detail-preview">
              <img src={expandedImage.url} alt={expandedImage.title} referrerPolicy="no-referrer" />
            </div>
            <div className="wikios-imgs-detail-info">
              <h3>{expandedImage.title.replace(/^File:/, "").replace(/_/g, " ")}</h3>
              <div className="wikios-imgs-detail-meta">
                {expandedImage.width && expandedImage.height && (
                  <span>
                    {expandedImage.width} × {expandedImage.height} px
                  </span>
                )}
                {expandedImage.mime && <span>{expandedImage.mime}</span>}
              </div>
              <div className="wikios-imgs-detail-actions">
                <button
                  onClick={() => handleCopy(expandedImage)}
                  className="wikios-imgs-detail-btn"
                >
                  {copiedId === expandedImage.url ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy wikitext
                    </>
                  )}
                </button>
                <a
                  href={expandedImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wikios-imgs-detail-btn wikios-imgs-detail-btn-secondary"
                >
                  <ExternalLink size={12} /> View full size
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { ImageResult };
