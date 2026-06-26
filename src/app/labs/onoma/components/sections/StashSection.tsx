"use client";

// src/app/labs/onoma/components/sections/StashSection.tsx
// Onoma Lab — Stash Section (Facet Rebuild — Side-by-Side)

import { useState, useRef, useEffect } from "react";
import {
  Bookmark,
  BookOpen,
  Trash2,
  Globe,
  Lock,
  Wrench,
  Copy,
  Check,
  ArrowUpRight,
  Search,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { useNameBank } from "~/hooks/useNameBank";
import { UseNameDialog } from "../shared/UseNameDialog";
import { FacetCard } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { api } from "~/trpc/react";

interface StashSectionProps {
  onLoadToStudio?: (words: string[], title: string) => void;
}

export function StashSection({ onLoadToStudio }: StashSectionProps) {
  const bank = useNameBank();

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStashFilterId, setSelectedStashFilterId] = useState<string>("all");

  // Dictionary collapse state
  const [expandedDicts, setExpandedDicts] = useState<Record<string, boolean>>({});

  // Copy states
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Name deployment modal
  const [selectedNameForUse, setSelectedNameForUse] = useState<string | null>(null);

  // Stashing popover states
  const [stashNameId, setStashNameId] = useState<string | null>(null);
  const [stashDictId, setStashDictId] = useState<string | null>(null);
  const [stashingFolderId, setStashingFolderId] = useState<string | null>(null);
  const [stashFeedback, setStashFeedback] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Queries for stashing
  const stashesQuery = api.wikios.getStashes.useQuery();

  // Close active stashing popovers on click outside
  useEffect(() => {
    if (stashNameId === null && stashDictId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setStashNameId(null);
        setStashDictId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [stashNameId, stashDictId]);

  // Filter entries based on search and folder filter
  const savedNames =
    bank.nameBank?.filter((e) => {
      const matchSearch =
        e.type === "saved-name" && e.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFolder =
        selectedStashFilterId === "all" || (e as any).stashId === selectedStashFilterId;
      return matchSearch && matchFolder;
    }) || [];

  const dictionaries =
    bank.nameBank?.filter((e) => {
      const matchSearch =
        e.type === "dictionary" && e.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFolder =
        selectedStashFilterId === "all" || (e as any).stashId === selectedStashFilterId;
      return matchSearch && matchFolder;
    }) || [];

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

  const handleStashDict = async (
    id: string,
    dictTitle: string,
    values: string[],
    stashId: string,
    stashName: string
  ) => {
    setStashingFolderId(stashId);
    try {
      await bank.saveEntry({
        id,
        type: "dictionary",
        title: dictTitle,
        values,
        stashId,
      });
      setStashFeedback(`Moved to ${stashName}!`);
      setTimeout(() => {
        setStashFeedback(null);
        setStashDictId(null);
      }, 1500);
    } catch (err) {
      console.error("Failed to move dictionary:", err);
      setStashFeedback("Failed to move");
      setTimeout(() => setStashFeedback(null), 1500);
    } finally {
      setStashingFolderId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Title Header & Search/Filters */}
      <div className="border-border/40 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-foreground text-xl font-bold tracking-tight">Stash</h2>
          <p className="text-muted-foreground text-sm">
            Manage your saved names and custom dictionaries.
          </p>
        </div>

        {/* Filter Dropdown & Search Input */}
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          {/* Folder filter dropdown */}
          <div className="relative w-full sm:w-44">
            <select
              value={selectedStashFilterId}
              onChange={(e) => setSelectedStashFilterId(e.target.value)}
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-1.5 text-xs focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none"
            >
              <option value="all">📁 All Folders</option>
              {stashesQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  📁 {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
            <input
              type="text"
              placeholder="Search saved items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border/60 bg-background text-foreground placeholder-muted-foreground w-full rounded-lg border py-2 pr-4 pl-9 text-xs focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Two-Column Side-by-Side Layout */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5/12): Saved Names Badges */}
        <div className="space-y-3 lg:col-span-5">
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

                return (
                  <FacetCard
                    key={entry.id}
                    className="group border-border/40 bg-secondary/5 relative flex items-center justify-between overflow-hidden border px-3 py-2.5 transition-all duration-300 hover:border-[#0091ff]/45 hover:shadow-[0_0_12px_rgba(0,145,255,0.08)] dark:hover:border-[#0091ff]/35 dark:hover:shadow-[0_0_16px_rgba(0,145,255,0.15)]"
                  >
                    {/* Texture Overlay */}
                    <div className="pointer-events-none absolute -inset-2 opacity-[0.08] transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:opacity-20 group-hover:blur-[1px] dark:opacity-45 dark:group-hover:opacity-85">
                      <TextureOverlay texture="diamonds" className="mix-blend-overlay" />
                    </div>

                    <div className="relative z-10 flex max-w-[60%] flex-col gap-0.5">
                      <span className="text-foreground truncate text-sm font-semibold tracking-wide transition-colors group-hover:text-[#0091ff]">
                        {nameValue}
                      </span>
                      {(entry as any).stashName && (
                        <span
                          className="inline-flex w-fit shrink-0 items-center gap-1 truncate rounded px-1.5 py-0.5 text-[9px] font-bold select-none"
                          style={{
                            backgroundColor: `${(entry as any).stashColor || "#3b82f6"}20`,
                            color: (entry as any).stashColor || "#3b82f6",
                          }}
                        >
                          📁 {(entry as any).stashName}
                        </span>
                      )}
                    </div>

                    <div className="relative z-10 flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(entry.id, nameValue)}
                        title="Copy to clipboard"
                        className="text-muted-foreground rounded p-1 transition-all duration-200 hover:bg-emerald-500/10 hover:text-emerald-500"
                      >
                        {copiedId === entry.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Stash Export Button (Move folder) */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setStashDictId(null);
                            setStashNameId(isStashingThis ? null : entry.id);
                          }}
                          title="Move to another Stash folder"
                          className={`rounded p-1 transition-all duration-200 ${
                            isStashingThis
                              ? "bg-indigo-500/10 text-indigo-500"
                              : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-500"
                          }`}
                        >
                          <FolderPlus className="h-3.5 w-3.5" />
                        </button>

                        {isStashingThis && (
                          <div
                            ref={popoverRef}
                            className="bg-popover/85 animate-in fade-in absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-white/10 p-1.5 shadow-xl shadow-black/20 backdrop-blur-lg duration-100 dark:border-white/5"
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
                                  onClick={() => handleStashName(entry.id, nameValue, s.id, s.name)}
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

                      {/* Use */}
                      <button
                        onClick={() => setSelectedNameForUse(nameValue)}
                        title="Use this name in game"
                        className="text-muted-foreground rounded p-1 transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        title="Delete saved name"
                        className="text-muted-foreground rounded p-1 transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </FacetCard>
                );
              })}
            </div>
          ) : (
            <div className="border-border/40 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-xs">
              No matching saved names.
            </div>
          )}
        </div>

        {/* Right Column (7/12): Saved Dictionaries */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Saved Dictionaries ({dictionaries.length})
            </h3>
          </div>

          {dictionaries.length > 0 ? (
            <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
              {dictionaries.map((dict) => {
                const isExpanded = !!expandedDicts[dict.id];
                const wordsCount = dict.values.length;
                const previewWords = dict.values.slice(0, 12).join(", ");
                const isStashingThisDict = stashDictId === dict.id;

                return (
                  <FacetCard
                    key={dict.id}
                    className="border-border/40 bg-secondary/5 space-y-3 border p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4 text-[#0091ff]/80" />
                          <h4 className="text-foreground text-sm font-bold">{dict.title}</h4>
                        </div>
                        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="capitalize">Category: {dict.category || "Any"}</span>
                          <span>•</span>
                          <span>{wordsCount} seeds</span>
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

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-1">
                        {/* Expand Button */}
                        <button
                          onClick={() => toggleExpandDict(dict.id)}
                          className="bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex items-center gap-0.5 rounded px-2 py-1 text-[11px]"
                          title={isExpanded ? "Hide word list" : "Show word list"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          <span>Words</span>
                        </button>

                        {/* Load to Studio / Generate */}
                        {onLoadToStudio && (
                          <button
                            onClick={() => onLoadToStudio(dict.values, dict.title)}
                            className="flex items-center gap-0.5 rounded bg-[#0091ff]/10 px-2 py-1 text-[11px] font-semibold text-[#0091ff] hover:bg-[#0091ff]/20"
                            title="Load into Custom Studio Workshop"
                          >
                            <Wrench className="h-3 w-3" />
                            <span>Load Studio</span>
                          </button>
                        )}

                        {/* Stash Export Dropdown (Move Folder) */}
                        <div className="relative">
                          <button
                            onClick={() => {
                              setStashNameId(null);
                              setStashDictId(isStashingThisDict ? null : dict.id);
                            }}
                            className={`flex items-center gap-0.5 rounded px-2 py-1 text-[11px] transition-colors ${
                              isStashingThisDict
                                ? "bg-indigo-500/10 text-indigo-500"
                                : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-[#0091ff]"
                            }`}
                            title="Move dictionary to another Stash folder"
                          >
                            <FolderPlus className="h-3 w-3" />
                            <span>Move</span>
                          </button>

                          {isStashingThisDict && (
                            <div
                              ref={popoverRef}
                              className="bg-popover/85 animate-in fade-in absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-white/10 p-1.5 shadow-xl shadow-black/20 backdrop-blur-lg duration-100 dark:border-white/5"
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
                                      handleStashDict(
                                        dict.id,
                                        dict.title,
                                        dict.values,
                                        s.id,
                                        s.name
                                      )
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

                        {/* Share toggle */}
                        <button
                          onClick={() => handleTogglePublic(dict.id, dict.isPublic)}
                          className={`flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                            dict.isPublic
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                          }`}
                          title={
                            dict.isPublic
                              ? "Shared publicly (click to make private)"
                              : "Private (click to share publicly)"
                          }
                        >
                          {dict.isPublic ? (
                            <Globe className="h-3 w-3" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                          <span>{dict.isPublic ? "Public" : "Private"}</span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(dict.id)}
                          className="bg-secondary/30 text-muted-foreground rounded p-1 transition-colors hover:bg-red-500/10 hover:text-red-500"
                          title="Delete dictionary"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Word List Preview (Collapsible) */}
                    {isExpanded && (
                      <div className="bg-background border-border/40 animate-in slide-in-from-top-2 space-y-1.5 rounded-lg border p-2.5 duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                            Full Word List ({wordsCount})
                          </span>
                          <button
                            onClick={() => handleCopy(dict.id, dict.values.join(", "))}
                            className="text-[10px] font-semibold text-[#0091ff] hover:opacity-85"
                          >
                            {copiedId === dict.id ? "Copied!" : "Copy CSV"}
                          </button>
                        </div>
                        <div className="text-foreground max-h-32 overflow-y-auto pr-1 font-mono text-xs leading-relaxed select-all">
                          {dict.values.join(", ")}
                        </div>
                      </div>
                    )}

                    {!isExpanded && wordsCount > 0 && (
                      <div className="text-muted-foreground truncate text-[10px] italic">
                        Seeds: {previewWords}
                        {wordsCount > 12 && " ..."}
                      </div>
                    )}
                  </FacetCard>
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

      {/* Deployment Modal */}
      {selectedNameForUse && (
        <UseNameDialog
          isOpen={!!selectedNameForUse}
          onClose={() => setSelectedNameForUse(null)}
          name={selectedNameForUse}
          category="person"
        />
      )}
    </div>
  );
}

export default StashSection;
