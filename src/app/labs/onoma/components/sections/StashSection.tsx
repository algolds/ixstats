"use client";

// src/app/labs/onoma/components/sections/StashSection.tsx
// Onoma Lab — Stash Section (Facet Rebuild — Side-by-Side)

import { useState, useRef, useEffect } from "react";
import { Trash as Trash2, Search, FolderPlus, SystemRestart as Loader2 } from "iconoir-react";
import { useNameBank } from "~/hooks/useNameBank";
import { NameResultCard } from "../shared/NameResultCard";
import { UseNameDialog } from "../shared/UseNameDialog";
import { DictionaryEditModal, type DictEditValue } from "../shared/DictionaryEditModal";
import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ImportStashPanel } from "../stash/ImportStashPanel";
import { SavedDictionaryCard } from "../stash/SavedDictionaryCard";
import { StudioLexicon } from "./studio/StudioLexicon";
import { useStudioState } from "../../hooks/useStudioState";
import HistorySection from "./HistorySection";
import { cn } from "~/lib/utils";
import type { NameCategory, ExploreSubTab, StudioSubTab } from "~/lib/onoma/types";

interface StashSectionProps {
  onLoadToStudio?: (words: string[], title: string) => void;
  onNavigateExplore?: (tab: ExploreSubTab, words?: string[], title?: string) => void;
  onNavigateStudio?: (tab: StudioSubTab, words?: string[], title?: string) => void;
}

export function StashSection({
  onLoadToStudio,
  onNavigateExplore,
  onNavigateStudio,
}: StashSectionProps) {
  const bank = useNameBank();
  const studioState = useStudioState();

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStashFilterId, setSelectedStashFilterId] = useState<string>("all");

  // Dictionary collapse state
  const [expandedDicts, setExpandedDicts] = useState<Record<string, boolean>>({});

  // Copy states
  // oxlint-disable-next-line eslint/no-unused-vars
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Name deployment modal
  const [selectedNameForUse, setSelectedNameForUse] = useState<string | null>(null);

  // Dictionary edit modal & export state
  const [editDict, setEditDict] = useState<DictEditValue | null>(null);

  // Stashing popover states (for saved names)
  const [stashNameId, setStashNameId] = useState<string | null>(null);
  const [stashingFolderId, setStashingFolderId] = useState<string | null>(null);
  const [stashFeedback, setStashFeedback] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Queries for stashing
  const stashesQuery = api.wikios.getStashes.useQuery();

  // Close active stashing popovers on click outside
  useEffect(() => {
    if (stashNameId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setStashNameId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [stashNameId]);

  // Filter entries based on search and folder filter
  const savedNames =
    bank.nameBank?.filter((e) => {
      const entry = e as { type: string; title: string; stashId?: string };
      const matchSearch =
        entry.type === "saved-name" && entry.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFolder =
        selectedStashFilterId === "all" || entry.stashId === selectedStashFilterId;
      return matchSearch && matchFolder;
    }) || [];

  const dictionaries =
    bank.nameBank?.filter((e) => {
      const entry = e as { type: string; title: string; stashId?: string };
      const matchSearch =
        entry.type === "dictionary" && entry.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFolder =
        selectedStashFilterId === "all" || entry.stashId === selectedStashFilterId;
      return matchSearch && matchFolder;
    }) || [];

  // oxlint-disable-next-line eslint/no-unused-vars
  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await bank.deleteEntry(id);
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  // oxlint-disable-next-line eslint/no-unused-vars
  const handleTogglePublic = async (id: string, currentPublic: boolean) => {
    try {
      await bank.togglePublic(id, !currentPublic);
    } catch (err) {
      console.error("Failed to toggle public status:", err);
    }
  };

  const toggleExpandDict = (id: string) => {
    setExpandedDicts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditSave = async (next: DictEditValue) => {
    await bank.saveEntry({
      id: next.id,
      type: "dictionary",
      title: next.title,
      values: next.values,
      category: (next.category as NameCategory) || null,
      role: next.role,
      gender: next.gender,
      setName: next.setName,
    });

    const original = dictionaries.find((d) => d.id === next.id);
    if (original && original.isPublic !== next.isPublic) {
      await bank.togglePublic(next.id, next.isPublic);
    }
  };

  const handleExport = (title: string, values: string[], format: "txt" | "csv" | "json") => {
    let content: string;
    let mime: string;
    if (format === "json") {
      content = JSON.stringify({ title, values }, null, 2);
      mime = "application/json";
    } else if (format === "csv") {
      content = values.map((v) => `"${v.replace(/"/g, '""')}"`).join("\n");
      mime = "text/csv";
    } else {
      content = values.join("\n");
      mime = "text/plain";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w.-]+/g, "_")}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStashName = async (id: string, name: string, stashId: string, stashName: string) => {
    setStashingFolderId(stashId);
    try {
      await bank.saveEntry({
        id,
        type: "saved-name",
        title: name,
        values: [name],
        stashId,
      });
      setStashFeedback(`Moved to ${stashName}!`);
      setTimeout(() => {
        setStashFeedback(null);
        setStashNameId(null);
      }, 1500);
    } catch (err) {
      console.error("Failed to move name:", err);
      setStashFeedback("Failed to move");
      setTimeout(() => setStashFeedback(null), 1500);
    } finally {
      setStashingFolderId(null);
    }
  };

  const [stashTab, setStashTab] = useState<"saved" | "lexicon" | "history">("saved");

  return (
    <div className="space-y-5">
      {/* Tab Switcher & Filters/Import */}
      <div className="border-border/40 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        {/* Sub-tab Toggle buttons */}
        <div className="bg-secondary/15 border-border/20 flex gap-1 rounded-lg border p-1 select-none">
            <button
              onClick={() => setStashTab("saved")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                stashTab === "saved"
                  ? "bg-onoma-primary/10 text-onoma-primary shadow-[inset_0_1px_0_rgba(0,145,255,0.15)] dark:text-onoma-primary-light font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Saved Items
            </button>
            <button
              onClick={() => setStashTab("lexicon")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                stashTab === "lexicon"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)] font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Lexicon Dictionary
            </button>
            <button
              onClick={() => setStashTab("history")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                stashTab === "history"
                  ? "bg-onoma-primary/10 text-onoma-primary shadow-[inset_0_1px_0_rgba(0,145,255,0.15)] dark:text-onoma-primary-light font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Generation History
            </button>
          </div>

          {stashTab === "saved" && (
            <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
              {/* Upload .txt files (one dictionary per file) */}
              <ImportStashPanel />

              {/* Folder filter dropdown */}
              <div className="relative w-full sm:w-44">
                <Select value={selectedStashFilterId} onValueChange={setSelectedStashFilterId}>
                  <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-xs transition-colors focus:border-onoma-primary/50 focus:ring-1 focus:ring-onoma-primary/50 focus:outline-none">
                    <SelectValue placeholder="All Folders" />
                  </SelectTrigger>
                  <SelectContent className="border-border/40 bg-background/95 max-h-[300px] backdrop-blur-md">
                    <SelectItem
                      value="all"
                      className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                    >
                      📁 All Folders
                    </SelectItem>
                    {stashesQuery.data?.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                      >
                        📁 {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-56">
                <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search saved items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-border/60 bg-background text-foreground placeholder-muted-foreground w-full rounded-lg border py-2 pr-4 pl-9 text-xs focus:border-onoma-primary/50 focus:ring-1 focus:ring-onoma-primary/50 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

      {stashTab === "history" ? (
        <HistorySection hideHeader={true} onLoadToStudio={onLoadToStudio} />
      ) : stashTab === "lexicon" ? (
        <StudioLexicon state={studioState} />
      ) : (
        <>
          {/* Existing Name Sets for the editor datalist */}
          <datalist id="onoma-existing-sets">
            {Array.from(
              new Set(
                (bank.nameBank ?? [])
                  .map((e) => (e as { setName?: string | null }).setName)
                  .filter((s): s is string => !!s)
              )
            ).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {/* Two-Column Side-by-Side Layout */}
          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* Left Column (7/12): Saved Names Badges */}
            <div className="space-y-3 lg:col-span-7">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Saved Names ({savedNames.length})
                </h3>
              </div>

              {savedNames.length > 0 ? (
                <div className="grid max-h-[600px] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {savedNames.map((entry) => {
                    const nameValue = entry.values[0] || entry.title;
                    const isStashingThis = stashNameId === entry.id;
                    const e = entry as { setName?: string | null; category?: string | null };
                    // What kind of word: dictionary-set origin wins, else generator category.
                    const originLabel = e.setName
                      ? `Dictionary: ${e.setName}`
                      : entry.category
                        ? `Category: ${entry.category}`
                        : "Saved name";

                    return (
                      <NameResultCard
                        key={entry.id}
                        name={nameValue}
                        isSaved
                        allowCustomize
                        expandOnCardClick
                        onUse={() => setSelectedNameForUse(nameValue)}
                        savedAt={entry.createdAt}
                        originLabel={originLabel}
                        headerExtras={
                          <>
                            {/* Move to another Stash folder */}
                            <div className="relative">
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setStashNameId(isStashingThis ? null : entry.id);
                                }}
                                title="Move to another Stash folder"
                                className={`cursor-pointer rounded-md p-1.5 transition-all duration-200 active:scale-90 ${
                                  isStashingThis
                                    ? "bg-indigo-500/10 text-indigo-500"
                                    : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-500"
                                }`}
                              >
                                <FolderPlus className="h-4 w-4" />
                              </button>

                              {isStashingThis && (
                                <div
                                  ref={popoverRef}
                                  className="bg-popover/95 animate-in fade-in border-border/60 absolute right-0 z-30 mt-1.5 w-52 rounded-xl border p-1.5 shadow-xl shadow-black/20 backdrop-blur-lg duration-100"
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
                                        onClick={() =>
                                          handleStashName(entry.id, nameValue, s.id, s.name)
                                        }
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

                            {/* Delete */}
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDelete(entry.id);
                              }}
                              title="Delete saved name"
                              className="text-muted-foreground cursor-pointer rounded-md p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-500 active:scale-90"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="border-border/40 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-xs">
                  No matching saved names.
                </div>
              )}
            </div>

            {/* Right Column (5/12): Saved Dictionaries */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Saved Dictionaries ({dictionaries.length})
                </h3>
              </div>

              {dictionaries.length > 0 ? (
                <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
                  {dictionaries.map((dict) => {
                    const isExpanded = !!expandedDicts[dict.id];
                    return (
                      <SavedDictionaryCard
                        key={dict.id}
                        dict={dict}
                        isExpanded={isExpanded}
                        onToggleExpand={() => toggleExpandDict(dict.id)}
                        onLoadToStudio={onLoadToStudio}
                        onNavigateExplore={onNavigateExplore}
                        onNavigateStudio={onNavigateStudio}
                        onEdit={(d) =>
                          setEditDict({
                            id: d.id,
                            title: d.title,
                            values: d.values,
                            category: d.category ?? null,
                            role: d.role ?? null,
                            gender: d.gender ?? null,
                            setName: d.setName ?? null,
                            isPublic: d.isPublic,
                          })
                        }
                        onDelete={handleDelete}
                        handleExport={handleExport}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="border-border/40 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-xs">
                  No matching custom dictionaries.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Deployment Modal */}
      {selectedNameForUse && (
        <UseNameDialog
          isOpen={!!selectedNameForUse}
          onClose={() => setSelectedNameForUse(null)}
          name={selectedNameForUse}
          category="person"
        />
      )}

      {/* Edit Dictionary Modal */}
      {editDict && (
        <DictionaryEditModal
          dict={editDict}
          onClose={() => setEditDict(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}

export default StashSection;
