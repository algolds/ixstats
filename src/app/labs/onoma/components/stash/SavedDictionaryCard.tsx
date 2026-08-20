"use client";

// src/app/labs/onoma/components/stash/SavedDictionaryCard.tsx
// Onoma Custom Studio Workshop — Saved Dictionary Card Component

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Globe,
  Lock,
  ChevronUp,
  ChevronDown,
  Wrench,
  FolderPlus,
  Pencil,
  Download,
  Trash2,
  Loader2,
  AudioLines,
  GitFork,
  Sparkles,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { useNameBank } from "~/hooks/useNameBank";
import type { NameCategory, ExploreSubTab, StudioSubTab } from "~/lib/onoma/types";

interface SavedDictionaryCardProps {
  dict: {
    id: string;
    title: string;
    values: string[];
    category?: string | null;
    role?: string | null;
    gender?: string | null;
    setName?: string | null;
    stashName?: string | null;
    stashColor?: string | null;
    isPublic: boolean;
    clonedFromId?: string | null;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onLoadToStudio?: (values: string[], title: string) => void;
  onNavigateExplore?: (tab: ExploreSubTab, words?: string[], title?: string) => void;
  onNavigateStudio?: (tab: StudioSubTab, words?: string[], title?: string) => void;
  onEdit: (dict: SavedDictionaryCardProps["dict"]) => void;
  onDelete: (id: string) => void;
  handleExport: (title: string, values: string[], format: "txt" | "csv" | "json") => void;
}

export function SavedDictionaryCard({
  dict,
  isExpanded,
  onToggleExpand,
  onLoadToStudio,
  onNavigateExplore,
  onNavigateStudio,
  onEdit,
  onDelete,
  handleExport,
}: SavedDictionaryCardProps) {
  const bank = useNameBank();
  const [stashingFolderId, setStashingFolderId] = useState<string | null>(null);
  const [isStashingThis, setIsStashingThis] = useState(false);
  const [showExportPopover, setShowExportPopover] = useState(false);
  const [stashFeedback, setStashFeedback] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Stash queries
  const stashesQuery = api.wikios.getStashes.useQuery();

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsStashingThis(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMoveFolder = async (stashId: string, stashName: string) => {
    setStashingFolderId(stashId);
    try {
      await bank.saveEntry({
        id: dict.id,
        type: "dictionary",
        title: dict.title,
        values: dict.values,
        category: (dict.category as NameCategory) || null,
        role: dict.role,
        gender: dict.gender,
        setName: dict.setName,
        stashId,
      });
      setStashFeedback(`Moved to ${stashName}!`);
      setTimeout(() => {
        setStashFeedback(null);
        setIsStashingThis(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to move dictionary:", err);
      setStashFeedback("Failed to move");
      setTimeout(() => setStashFeedback(null), 1500);
    } finally {
      setStashingFolderId(null);
    }
  };

  const wordsCount = dict.values.length;
  const previewWords = dict.values.slice(0, 12).join(", ");

  return (
    <FacetCard
      className="border-border/40 bg-card/40 rounded-xl p-3.5 shadow-sm transition-all"
    >
      <div className="space-y-2.5">
        {/* Header & Meta Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-foreground truncate text-xs font-bold">{dict.title}</h4>
            <div className="text-muted-foreground/80 mt-0.5 flex items-center gap-1.5 text-[10px]">
              <span>{wordsCount} words</span>
              {dict.category && (
                <>
                  <span>•</span>
                  <span className="capitalize">{dict.category}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="bg-secondary/40 text-muted-foreground flex items-center gap-1 rounded px-1.5 py-0.5">
              {dict.isPublic ? (
                <>
                  <Globe className="h-3 w-3 text-emerald-500" />
                  <span className="font-semibold text-emerald-500">Public</span>
                </>
              ) : (
                <>
                  <Lock className="text-muted-foreground h-3 w-3" />
                  <span>Private</span>
                </>
              )}
            </span>
            {dict.role && (
              <span className="rounded bg-[#0091ff]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0091ff] capitalize">
                {dict.role}
                {dict.gender && dict.gender !== "any" ? ` · ${dict.gender}` : ""}
              </span>
            )}
            {dict.setName && (
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400">
                ⚇ {dict.setName}
              </span>
            )}
            {dict.clonedFromId && (
              <>
                <span>•</span>
                <span className="font-semibold text-[#0091ff]/80">Cloned</span>
              </>
            )}
            {dict.stashName && (
              <>
                <span>•</span>
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold select-none"
                  style={{
                    backgroundColor: `${dict.stashColor || "#3b82f6"}20`,
                    color: dict.stashColor || "#3b82f6",
                  }}
                >
                  📁 {dict.stashName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="border-border/10 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          {/* Primary Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Expand Button */}
            <button
              onClick={onToggleExpand}
              className="bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-[11px] active:scale-[0.97] transition-all"
              title={isExpanded ? "Hide word list" : "Show word list"}
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span>Words</span>
            </button>

            {/* Load to Studio / Generate */}
            {onLoadToStudio && (
              <button
                onClick={() => onLoadToStudio(dict.values, dict.title)}
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded bg-[#0091ff]/10 px-2 text-[11px] font-semibold text-[#0091ff] hover:bg-[#0091ff]/20 active:scale-[0.97] transition-all"
                title="Load into Studio Workshop"
              >
                <Wrench className="h-3 w-3" />
                <span>Studio</span>
              </button>
            )}

            {/* Quick Cross-System Actions */}
            {onNavigateExplore && (
              <button
                onClick={() => onNavigateExplore("phonology", dict.values, dict.title)}
                className="bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-[11px] font-semibold active:scale-[0.97] transition-all"
                title="Inspect IPA acoustics & compare profile"
              >
                <AudioLines className="h-3 w-3" />
                <span className="hidden sm:inline">Compare</span>
              </button>
            )}

            {onNavigateStudio && (
              <button
                onClick={() => onNavigateStudio("shifts", dict.values, dict.title)}
                className="bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-[11px] font-semibold active:scale-[0.97] transition-all"
                title="Evolve words in Historical Sound Shifts"
              >
                <GitFork className="h-3 w-3" />
                <span className="hidden sm:inline">Shifts</span>
              </button>
            )}

            {onNavigateExplore && (
              <button
                onClick={() => onNavigateExplore("writing", dict.values, dict.title)}
                className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-[11px] font-semibold active:scale-[0.97] transition-all"
                title="Typeset words in Writing Systems"
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">Script</span>
              </button>
            )}

            {/* Stash Export Dropdown (Move Folder) */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsStashingThis(!isStashingThis);
                }}
                className={cn(
                  "flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-[11px] transition-all active:scale-[0.97]",
                  isStashingThis
                    ? "bg-indigo-500/10 text-indigo-500"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-[#0091ff]"
                )}
                title="Move dictionary to another Stash folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Move</span>
              </button>

              {isStashingThis && (
                <div
                  ref={popoverRef}
                  className="bg-popover/95 animate-in fade-in border-border/60 absolute left-0 z-30 mt-1.5 w-52 rounded-xl border p-1.5 shadow-xl shadow-black/20 backdrop-blur-lg duration-100"
                >
                  <div className="text-muted-foreground border-border/40 mb-1 flex items-center justify-between border-b px-2 py-1.5 text-[10px] font-bold uppercase">
                    <span>Stash Folders</span>
                    <span className="rounded bg-indigo-500/10 px-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                      Global
                    </span>
                  </div>
                  {stashesQuery.isLoading && (
                    <div className="text-muted-foreground flex items-center gap-1.5 px-2 py-1.5 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading stashes...</span>
                    </div>
                  )}
                  {stashesQuery.data && stashesQuery.data.length === 0 && (
                    <div className="text-muted-foreground px-2 py-1.5 text-xs italic">
                      No stash folders found.
                    </div>
                  )}
                  <div className="max-h-36 space-y-0.5 overflow-y-auto">
                    {stashesQuery.data?.map((s) => (
                      <button
                        key={s.id}
                        disabled={stashingFolderId !== null}
                        onClick={() => handleMoveFolder(s.id, s.name)}
                        className="text-foreground flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 disabled:opacity-50 dark:hover:text-indigo-400"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate">{s.name}</span>
                        </span>
                        {stashingFolderId === s.id && (
                          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                        )}
                      </button>
                    ))}
                  </div>
                  {stashFeedback && (
                    <div className="mt-1.5 rounded bg-indigo-500/10 px-2 py-1 text-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {stashFeedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Secondary Utilities */}
          <div className="flex items-center gap-1.5">
            {/* Edit (rename / re-tag) */}
            <button
              onClick={() => onEdit(dict)}
              className="bg-secondary/30 text-muted-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
              title="Edit dictionary (rename, role, set)"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            {/* Export */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setShowExportPopover(!showExportPopover)}
                className="bg-secondary/30 text-muted-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                title="Export dictionary"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {showExportPopover && (
                <div className="bg-popover/95 border-border/60 absolute right-0 z-30 mt-1.5 w-28 rounded-lg border p-1 shadow-xl backdrop-blur-lg">
                  {(["txt", "csv", "json"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        handleExport(dict.title, dict.values, fmt);
                        setShowExportPopover(false);
                      }}
                      className="text-foreground flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      <span className="uppercase">{fmt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete */}
            <button
              onClick={() => onDelete(dict.id)}
              className="bg-secondary/30 text-muted-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="Delete dictionary"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded list of words */}
      {isExpanded && (
        <div className="border-border/10 border-t pt-2.5 text-xs">
          <p className="text-muted-foreground line-clamp-3 font-mono leading-normal">
            {previewWords || "No words inside."}
            {wordsCount > 12 && " ..."}
          </p>
        </div>
      )}
    </FacetCard>
  );
}

export default SavedDictionaryCard;
