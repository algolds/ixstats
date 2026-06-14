"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Loader2, Film as IconGif } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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

// eslint-disable-next-line unused-imports/no-unused-vars
export function GifPicker({ onSelectGif, trigger, disabled = false }: GifPickerProps) {
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
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-purple-400 transition-colors hover:bg-white/5 hover:text-purple-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <IconGif className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="glass-hierarchy-child w-80 overflow-hidden border-green-500/20 bg-neutral-900/90 p-0 shadow-xl backdrop-blur-xl"
      >
        {/* Search */}
        <div className="relative border-b border-white/10 p-2">
          <Search className="text-muted-foreground absolute top-4 left-4 h-3.5 w-3.5" />
          <Input
            placeholder="Search GIPHY..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-white/10 bg-white/5 pl-8 text-xs focus:bg-white/10"
          />
        </div>

        {/* GIFs Grid View Area */}
        <div className="h-72 scrollbar-thin scrollbar-thumb-white/10 overflow-y-auto p-2">
          {isLoading && gifs.length === 0 ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-xs">
              <Loader2 className="h-5 w-5 animate-spin text-green-400" />
              <span>Searching GIPHY...</span>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs text-red-400">
              {error}
            </div>
          ) : gifs.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelectGif(gif)}
                  title={gif.title}
                  className="group relative aspect-video overflow-hidden rounded-md border border-transparent hover:border-green-400/50"
                >
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
              No GIFs found. Try searching for something else!
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
