"use client";

import React, { useState, useEffect } from "react";
import { SystemRestart as Loader2 } from "iconoir-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SearchField } from "~/components/ui/search-field";
import { Button } from "~/components/ui/button";

function GifIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M7 12h2a1 1 0 0 0 1-1V9.5A1.5 1.5 0 0 0 8.5 8H7v8" />
      <path d="M13 8v8" />
      <path d="M16 8h3m-3 4h2m-2 4h1" />
    </svg>
  );
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
}

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "1FCCq4KmjQjC6FdopmB3tr6UUqLepZ0F";

export const GifPicker = React.forwardRef<HTMLButtonElement, GifPickerProps>(
  ({ onSelectGif, trigger, disabled = false }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [gifs, setGifs] = useState<GiphyGif[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounce search query
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedQuery(searchQuery);
      }, 500);

      return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch GIFs from Giphy API
    useEffect(() => {
      if (!isOpen) return;

      const fetchGifs = async () => {
        setIsLoading(true);
        setError(null);
        try {
          let url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
          if (debouncedQuery.trim()) {
            url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
              debouncedQuery
            )}&limit=20&rating=g`;
          }

          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.statusText}`);
          }

          const json = await res.json();
          setGifs(json.data || []);
        } catch (err) {
          console.error("Giphy fetch error:", err);
          setError("Failed to load GIFs from Giphy. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };

      void fetchGifs();
    }, [isOpen, debouncedQuery]);

    const handleSelectGif = (gif: GiphyGif) => {
      // We send the original high quality GIF URL (or a downsized version if needed) to be saved as the attachment
      const gifUrl = gif.images.original.url;
      onSelectGif(gifUrl);
      setIsOpen(false);
      setSearchQuery("");
    };

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          {trigger ? (
            trigger
          ) : (
            <Button
              ref={ref}
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label="Insert GIF"
              className="text-tint hover:bg-tint-fill hover:text-tint size-8 p-0"
            >
              <GifIcon className="size-5" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 overflow-hidden p-0">
          {/* Search */}
          <div className="border-separator border-b p-2">
            <SearchField
              size="sm"
              placeholder="Search GIPHY..."
              aria-label="Search GIFs"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>

          {/* GIFs Grid View Area */}
          <div className="thin-scrollbar h-72 overflow-y-auto p-2">
            {isLoading && gifs.length === 0 ? (
              <div className="text-footnote text-label-secondary flex h-full flex-col items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                <span>Searching GIPHY...</span>
              </div>
            ) : error ? (
              <div className="text-footnote text-destructive flex h-full flex-col items-center justify-center p-4 text-center">
                {error}
              </div>
            ) : gifs.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSelectGif(gif)}
                    title={gif.title}
                    aria-label={gif.title || "GIF"}
                    className="border-separator hover:border-tint group rounded-control-sm relative aspect-video overflow-hidden border transition-[border-color,scale] duration-150 hover:scale-[1.02]"
                  >
                    <img
                      src={gif.images.fixed_height.url}
                      alt={gif.title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="bg-fill-4 absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-footnote text-label-secondary flex h-full items-center justify-center">
                No GIFs found. Try searching for something else!
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);
GifPicker.displayName = "GifPicker";
