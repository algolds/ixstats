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
  Xmark as X,
  Check,
  Shield,
  Crown,
  Page as Scroll,
  Coins,
  SunLight as Sun,
  Compass,
  Flask as FlaskConical,
  OpenBook as BookOpen,
  WhiteFlag as Flag,
  Hourglass,
  Group as UsersIcon,
  MagicWand as Wand2,
  Component as Layers,
  SystemRestart as Loader2,
} from "iconoir-react";
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
      // oxlint-disable-next-line
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
      // oxlint-disable-next-line
      setPage(1);
      // oxlint-disable-next-line
    }, [searchQuery, activeTag, selectedAuthor]);

    const displayedIcons = useMemo(() => {
      return filteredIcons.slice(0, page * pageSize);
    }, [filteredIcons, page, pageSize]);

    const hasMore = displayedIcons.length < filteredIcons.length;

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="border-border bg-background flex h-[88vh] max-h-[800px] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          {/* Header */}
          <DialogHeader className="border-border bg-card/50 border-b p-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  Game-Icons Vector Library
                  <Badge variant="secondary" className="font-mono text-xs">
                    {filteredIcons.length.toLocaleString()} icons
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Selecting for:{" "}
                  <span className="text-foreground font-semibold">
                    {targetSlot === "emblem" ? "Center Emblem / Sigil" : "Background Watermark"}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search & Tag Filter Toolbar */}
          <div className="border-border bg-muted/20 space-y-2.5 border-b p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search 4,100+ icons (e.g. sword, crown, dragon, scale, astrolabe)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pr-8 pl-9 text-xs"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Author Filter Dropdown */}
              <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
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
                    className="h-7 shrink-0 gap-1 rounded-md px-2.5 text-xs font-medium"
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
              <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 text-xs">
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
                <span>Loading 4,100+ Game-Icons library...</span>
              </div>
            ) : filteredIcons.length === 0 ? (
              <div className="text-muted-foreground flex h-64 flex-col items-center justify-center p-6 text-center text-xs">
                <Layers className="mb-2 h-8 w-8 opacity-30" />
                <p className="text-foreground font-medium">No matching icons found</p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Try searching with broader terms or clearing category filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9">
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
                          "group relative flex aspect-square flex-col items-center justify-center rounded-lg border p-2 text-center transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary ring-primary/40 shadow-xs ring-2"
                            : "border-border bg-card hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="mb-1 flex h-8 w-8 items-center justify-center">
                          <img
                            src={icon.path}
                            alt={icon.name}
                            className={cn(
                              "h-full w-full object-contain invert filter dark:filter-none",
                              isSelected ? "brightness-200" : "opacity-80 group-hover:opacity-100"
                            )}
                            loading="lazy"
                          />
                        </div>
                        <span className="line-clamp-1 w-full text-[10px] leading-tight font-medium">
                          {icon.name}
                        </span>

                        {isSelected && (
                          <div className="bg-primary-foreground text-primary absolute top-1 right-1 rounded-full p-0.5 shadow-xs">
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
                      Load More Icons (
                      {(filteredIcons.length - displayedIcons.length).toLocaleString()} remaining)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-border bg-card/30 text-muted-foreground flex items-center justify-between border-t p-3 px-5 text-xs">
            <span>
              Icons by Lorc, Delapouite & contributors,{" "}
              <a
                href="https://game-icons.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary font-medium hover:underline"
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
