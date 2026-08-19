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
} from "lucide-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { useNameBank } from "~/hooks/useNameBank";

interface SavedDictionaryCardProps {
  dict: {
    id: string;
    title: string;
    values: string[];
    category?: string | null;
    isPublic: boolean;
    clonedFromId?: string | null;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onLoadToStudio?: (values: string[], title: string) => void;
  onEdit: (dict: any) => void;
  onDelete: (id: string) => void;
  handleExport: (title: string, values: string[], format: "txt" | "csv" | "json") => void;
}

export function SavedDictionaryCard({
  dict,
  isExpanded,
  onToggleExpand,
  onLoadToStudio,
  onEdit,
  onDelete,
  handleExport,
}: SavedDictionaryCardProps) {
  const bank = useNameBank();

  // Popover State
  const [showStashPopover, setShowStashPopover] = useState(false);
  const [showExportPopover, setShowExportPopover] = useState(false);
  const [stashingFolderId, setStashingFolderId] = useState<string | null>(null);
  const [stashFeedback, setStashFeedback] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Queries
  const stashesQuery = api.wikios.getStashes.useQuery();

  // Outside Clicks Handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowStashPopover(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportPopover(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleStashDict = async (stashId: string, stashName: string) => {
    setStashingFolderId(stashId);
    try {
      await bank.saveEntry({
        id: dict.id,
        type: "dictionary",
        title: dict.title,
        values: dict.values,
        stashId,
      });
      setStashFeedback(`Moved to ${stashName}!`);
      setTimeout(() => {
        setStashFeedback(null);
        setShowStashPopover(false);
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
    <FacetCard className="border-border/40 bg-secondary/5 space-y-3 border p-3">
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 flex-shrink-0 text-[#0091ff]/80" />
            <h4 className="text-foreground truncate text-sm font-bold">{dict.title}</h4>
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="capitalize">Category: {dict.category || "Any"}</span>
            <span>•</span>
            <span>{wordsCount} seeds</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
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
            {(dict as any).role && (
              <span className="rounded bg-[#0091ff]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0091ff] capitalize">
                {(dict as any).role}
                {(dict as any).gender && (dict as any).gender !== "any"
                  ? ` · ${(dict as any).gender}`
                  : ""}
              </span>
            )}
            {(dict as any).setName && (
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400">
                ⚇ {(dict as any).setName}
              </span>
            )}
            {dict.clonedFromId && (
              <>
                <span>•</span>
                <span className="font-semibold text-[#0091ff]/80">Cloned</span>
              </>
            )}
            {(dict as any).stashName && (
              <>
                <span>•</span>
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold select-none"
                  style={{
                    backgroundColor: `${(dict as any).stashColor || "#3b82f6"}20`,
                    color: (dict as any).stashColor || "#3b82f6",
                  }}
                >
                  📁 {(dict as any).stashName}
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
              className="bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-[11px]"
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
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded bg-[#0091ff]/10 px-2.5 text-[11px] font-semibold text-[#0091ff] hover:bg-[#0091ff]/20"
                title="Load into Studio Workshop"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Load Studio</span>
              </button>
            )}

            {/* Stash Export Dropdown (Move Folder) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowStashPopover(!showStashPopover);
                }}
                className={cn(
                  "flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-[11px] transition-colors",
                  showStashPopover
                    ? "bg-indigo-500/10 text-indigo-500"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-[#0091ff]"
                )}
                title="Move dictionary to another Stash folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Move</span>
              </button>

              {showStashPopover && (
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
                        onClick={() => handleStashDict(s.id, s.name)}
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
