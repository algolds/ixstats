"use client";

// src/app/labs/onoma/components/shared/NameResultCard.tsx
// Onoma Lab — Card component to display individual generated names

import { useState, useRef, useEffect } from "react";
import { Copy, Check, Bookmark, ArrowUpRight, Loader2, FolderPlus } from "lucide-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";

interface NameResultCardProps {
  name: string;
  isSaved?: boolean;
  onSave?: (name: string, stashId?: string) => Promise<any>;
  onUse?: (name: string) => void;
}

export function NameResultCard({ name, isSaved = false, onSave, onUse }: NameResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // WikiOS/system stash popover state
  const [showStashPopover, setShowStashPopover] = useState(false);
  const [stashingFolderId, setStashingFolderId] = useState<string | null>(null);
  const [stashFeedback, setStashFeedback] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Queries for stashing
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    enabled: showStashPopover,
  });

  // Close popover on click outside
  useEffect(() => {
    if (!showStashPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowStashPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStashPopover]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleSave = async () => {
    if (!onSave || isSaved || saving) return;
    setSaving(true);
    try {
      await onSave(name);
    } catch (err) {
      console.error("Failed to save name:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleStashToFolder = async (stashId: string, stashName: string) => {
    if (!onSave) return;
    setStashingFolderId(stashId);
    try {
      await onSave(name, stashId);
      setStashFeedback(`Stashed in ${stashName}!`);
      setTimeout(() => {
        setStashFeedback(null);
        setShowStashPopover(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to stash name:", err);
      setStashFeedback("Failed to stash");
      setTimeout(() => setStashFeedback(null), 1500);
    } finally {
      setStashingFolderId(null);
    }
  };

  return (
    <FacetCard className="group relative flex items-center justify-between px-4 py-3.5 border border-border/40">
      {/* Name Display */}
      <span className="font-semibold tracking-wide text-foreground group-hover:text-[#0091ff] transition-colors duration-300 sm:text-base text-sm">
        {name}
      </span>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          title="Copy name to clipboard"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-90 transition-all duration-200"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>

        {/* Save/Bookmark Button (Onoma Local Stash) */}
        {onSave && (
          <button
            onClick={handleSave}
            disabled={isSaved || saving}
            title={isSaved ? "Saved to Local Stash" : "Save to Local Stash"}
            className={cn(
              "rounded-md p-1.5 transition-all duration-200 active:scale-90 disabled:opacity-50",
              isSaved
                ? "text-[#0091ff] bg-[#0091ff]/10"
                : "text-muted-foreground hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bookmark className={cn("h-4 w-4", isSaved && "fill-[#0091ff] text-[#0091ff]")} />
            )}
          </button>
        )}

        {/* LoreStash Export Button (Global Stash) */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowStashPopover(!showStashPopover)}
            title="Export to global Stash folder"
            className={cn(
              "rounded-md p-1.5 transition-all duration-200 active:scale-90",
              showStashPopover
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
            )}
          >
            <FolderPlus className="h-4 w-4" />
          </button>

          {showStashPopover && (
            <div className="absolute right-0 mt-1.5 z-30 w-52 rounded-xl border border-white/10 dark:border-white/5 bg-popover/85 backdrop-blur-lg p-1.5 shadow-xl shadow-black/20 animate-in fade-in duration-100">
              <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase border-b border-border/40 mb-1 flex items-center justify-between">
                <span>Stash Folders</span>
                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 px-1 bg-indigo-500/10 rounded">Global</span>
              </div>
              {stashesQuery.isLoading && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading stashes...</span>
                </div>
              )}
              {stashesQuery.data && stashesQuery.data.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                  No stash folders found.
                </div>
              )}
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {stashesQuery.data?.map((s) => (
                  <button
                    key={s.id}
                    disabled={stashingFolderId !== null}
                    onClick={() => handleStashToFolder(s.id, s.name)}
                    className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md text-xs text-foreground hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    {stashingFolderId === s.id && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
              {stashFeedback && (
                <div className="mt-1.5 px-2 py-1 text-[10px] font-bold text-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded">
                  {stashFeedback}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Use/Redirect Button */}
        {onUse && (
          <button
            onClick={() => onUse(name)}
            title="Deploy name in game"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500 active:scale-90 transition-all duration-200"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </FacetCard>
  );
}

export default NameResultCard;
