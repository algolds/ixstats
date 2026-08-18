/**
 * GameIconsBrowser Component
 *
 * Fast, filterable Facet Dialog to search and browse 4,100+ Game-Icons.net SVGs.
 * Uses standard Facet design tokens, theme compliance, and clean accessible controls.
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Check,
  Shield,
  Crown,
  Scroll,
  Coins,
  Sun,
  Compass,
  FlaskConical,
  BookOpen,
  Flag,
  Hourglass,
  Users as UsersIcon,
  Wand2,
  Layers,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { GameIconItem } from "./types";

interface GameIconsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  targetSlot: "emblem" | "watermark";
  selectedIcon: GameIconItem | null;
  onSelect: (icon: GameIconItem, target: "emblem" | "watermark") => void;
}

const CATEGORY_TAG_PRESETS = [
  { label: "All", tag: "" },
  { label: "Military", tag: "military", icon: Shield },
  { label: "Government", tag: "government", icon: Crown },
  { label: "Diplomacy", tag: "diplomacy", icon: Scroll },
  { label: "Economy", tag: "economy", icon: Coins },
  { label: "Religion", tag: "religion", icon: Sun },
  { label: "Geography", tag: "geography", icon: Compass },
  { label: "Science", tag: "science", icon: FlaskConical },
  { label: "Culture", tag: "culture", icon: BookOpen },
  { label: "Nation", tag: "nation", icon: Flag },
  { label: "History", tag: "history", icon: Hourglass },
  { label: "People", tag: "people", icon: UsersIcon },
  { label: "Special", tag: "special", icon: Wand2 },
];

export const GameIconsBrowser = React.memo<GameIconsBrowserProps>(
  ({ isOpen, onClose, targetSlot, selectedIcon, onSelect }) => {
    const [icons, setIcons] = useState<GameIconItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTag, setActiveTag] = useState("");
    const [selectedAuthor, setSelectedAuthor] = useState("all");
    const [page, setPage] = useState(1);
    const pageSize = 72;

    // Load manifest once on open
    useEffect(() => {
      if (!isOpen || icons.length > 0) return;
      setLoading(true);
      fetch("/icons/game-icons-manifest.json")
        .then((res) => res.json())
        .then((data: GameIconItem[]) => {
          setIcons(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load game-icons manifest:", err);
          setLoading(false);
        });
    }, [isOpen, icons.length]);

    // Unique authors list
    const authors = useMemo(() => {
      const set = new Set<string>();
      for (const ic of icons) {
        if (ic.author) set.add(ic.author);
      }
      return ["all", ...Array.from(set).sort()];
    }, [icons]);

    // Filtered icons
    const filteredIcons = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      return icons.filter((ic) => {
        if (selectedAuthor !== "all" && ic.author !== selectedAuthor) {
          return false;
        }
        if (activeTag && !ic.tags.includes(activeTag)) {
          return false;
        }
        if (q) {
          const matchName = ic.name.toLowerCase().includes(q);
          const matchSlug = ic.slug.toLowerCase().includes(q);
          const matchTag = ic.tags.some((t) => t.toLowerCase().includes(q));
          return matchName || matchSlug || matchTag;
        }
        return true;
      });
    }, [icons, searchQuery, activeTag, selectedAuthor]);

    // Reset pagination on filter change
    useEffect(() => {
      setPage(1);
    }, [searchQuery, activeTag, selectedAuthor]);

    const displayedIcons = useMemo(() => {
      return filteredIcons.slice(0, page * pageSize);
    }, [filteredIcons, page, pageSize]);

    const hasMore = displayedIcons.length < filteredIcons.length;

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl h-[88vh] max-h-[800px] flex flex-col p-0 gap-0 overflow-hidden border-border bg-background">
          {/* Header */}
          <DialogHeader className="p-5 pb-4 border-b border-border bg-card/50">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  Game-Icons Vector Library
                  <Badge variant="secondary" className="text-xs font-mono">
                    {filteredIcons.length.toLocaleString()} icons
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Selecting for:{" "}
                  <span className="font-semibold text-foreground">
                    {targetSlot === "emblem" ? "Center Emblem / Sigil" : "Background Watermark"}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search & Tag Filter Toolbar */}
          <div className="p-3 border-b border-border bg-muted/20 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search 4,100+ icons (e.g. sword, crown, dragon, scale, astrolabe)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Author Filter Dropdown */}
              <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Authors" />
                </SelectTrigger>
                <SelectContent>
                  {authors.map((auth) => (
                    <SelectItem key={auth} value={auth}>
                      {auth === "all" ? "All Authors" : auth}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Tag Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {CATEGORY_TAG_PRESETS.map((preset) => {
                const isActive = activeTag === preset.tag;
                const IconComponent = preset.icon;
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTag(preset.tag)}
                    className="h-7 px-2.5 text-xs font-medium shrink-0 gap-1 rounded-md"
                  >
                    {IconComponent && <IconComponent className="h-3 w-3" />}
                    <span>{preset.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Icons Grid Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Loading 4,100+ Game-Icons library...</span>
              </div>
            ) : filteredIcons.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-xs text-center p-6">
                <Layers className="h-8 w-8 mb-2 opacity-30" />
                <p className="font-medium text-foreground">No matching icons found</p>
                <p className="text-muted-foreground text-[11px] mt-1">
                  Try searching with broader terms or clearing category filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-2">
                  {displayedIcons.map((icon) => {
                    const isSelected = selectedIcon?.id === icon.id;
                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => {
                          onSelect(icon, targetSlot);
                          onClose();
                        }}
                        title={`${icon.name} (by ${icon.author})`}
                        className={cn(
                          "group relative flex flex-col items-center justify-center p-2 rounded-lg border transition-colors aspect-square text-center",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/40"
                            : "border-border bg-card hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="w-8 h-8 flex items-center justify-center mb-1">
                          <img
                            src={icon.path}
                            alt={icon.name}
                            className={cn(
                              "w-full h-full object-contain filter invert dark:filter-none",
                              isSelected ? "brightness-200" : "opacity-80 group-hover:opacity-100"
                            )}
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[10px] leading-tight line-clamp-1 w-full font-medium">
                          {icon.name}
                        </span>

                        {isSelected && (
                          <div className="absolute top-1 right-1 rounded-full bg-primary-foreground text-primary p-0.5 shadow-xs">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="flex justify-center pt-2 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      className="text-xs"
                    >
                      Load More Icons ({(filteredIcons.length - displayedIcons.length).toLocaleString()} remaining)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 px-5 border-t border-border bg-card/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Icons by Lorc, Delapouite & contributors,{" "}
              <a
                href="https://game-icons.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium"
              >
                game-icons.net
              </a>{" "}
              (CC BY 3.0)
            </span>
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

GameIconsBrowser.displayName = "GameIconsBrowser";
