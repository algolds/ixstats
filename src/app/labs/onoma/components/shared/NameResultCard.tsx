"use client";

// src/app/labs/onoma/components/shared/NameResultCard.tsx
// Onoma Lab — Card component to display individual generated names

import { useState, useRef, useEffect } from "react";
import {
  Copy,
  Check,
  Bookmark,
  ArrowUpRight,
  Loader2,
  FolderPlus,
  FolderCheck,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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
  const [hasStashed, setHasStashed] = useState(false);
  const [localSaved, setLocalSaved] = useState(isSaved);

  // Sync prop changes to local state
  useEffect(() => {
    setLocalSaved(isSaved);
  }, [isSaved]);

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
    if (!onSave || localSaved || saving) return;
    setSaving(true);
    try {
      await onSave(name);
      setLocalSaved(true);
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
      setHasStashed(true);
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
    <FacetCard
      depth={showStashPopover ? 3 : 1}
      className={cn(
        "group border-border/40 relative flex items-center justify-between overflow-hidden border px-4 py-3.5 transition-all duration-300",
        showStashPopover
          ? "z-40 border-indigo-500/30 bg-indigo-500/[0.02] shadow-lg ring-1 shadow-indigo-500/5 ring-indigo-500/10"
          : "z-10 hover:border-[#0091ff]/45 hover:shadow-[0_0_12px_rgba(0,145,255,0.08)] dark:hover:border-[#0091ff]/35 dark:hover:shadow-[0_0_16px_rgba(0,145,255,0.15)]"
      )}
    >
      {/* Texture Overlay */}
      <div className="pointer-events-none absolute -inset-2 opacity-[0.08] transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:opacity-20 group-hover:blur-[1px] dark:opacity-45 dark:group-hover:opacity-85">
        <TextureOverlay texture="diamonds" className="mix-blend-overlay" />
      </div>

      {/* Name Display */}
      <span className="text-foreground relative z-10 text-sm font-semibold tracking-wide transition-colors duration-300 group-hover:text-[#0091ff] sm:text-base">
        {name}
      </span>

      {/* Action Buttons */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-1.5 transition-opacity duration-300",
          showStashPopover ? "opacity-100" : "opacity-60 group-hover:opacity-100"
        )}
      >
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          title="Copy name to clipboard"
          className="text-muted-foreground rounded-md p-1.5 transition-all duration-200 hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-90 dark:hover:text-emerald-400"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>

        {/* Save/Bookmark Button (Onoma Local Stash) */}
        {onSave && (
          <button
            onClick={handleSave}
            disabled={localSaved || saving}
            title={localSaved ? "Saved to Local Stash" : "Save to Local Stash"}
            className={cn(
              "rounded-md p-1.5 transition-all duration-200 active:scale-90 disabled:opacity-50",
              localSaved
                ? "scale-105 bg-[#0091ff]/20 text-[#0091ff] shadow-[0_0_12px_rgba(0,145,255,0.35)] ring-1 ring-[#0091ff]/30"
                : "text-muted-foreground hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bookmark className={cn("h-4 w-4", localSaved && "fill-[#0091ff] text-[#0091ff]")} />
            )}
          </button>
        )}

        {/* LoreStash Export Button (Global Stash) */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowStashPopover(!showStashPopover)}
            title={hasStashed ? "Stashed to Global Stash" : "Export to global Stash folder"}
            className={cn(
              "rounded-md p-1.5 transition-all duration-200 active:scale-90",
              showStashPopover || hasStashed
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
            )}
          >
            {hasStashed ? (
              <FolderCheck className="h-4 w-4 scale-110 text-emerald-500 transition-all duration-300 dark:text-emerald-400" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
          </button>

          {showStashPopover && (
            <div className="bg-popover/85 animate-in fade-in absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-white/10 p-1.5 shadow-xl shadow-black/20 backdrop-blur-lg duration-100 dark:border-white/5">
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
                    onClick={() => handleStashToFolder(s.id, s.name)}
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

        {/* Use/Redirect Button */}
        {onUse && (
          <button
            onClick={() => onUse(name)}
            title="Deploy name in game"
            className="text-muted-foreground rounded-md p-1.5 transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500 active:scale-90"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </FacetCard>
  );
}

export default NameResultCard;
