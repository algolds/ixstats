"use client";

// src/app/labs/onoma/components/sections/StashSection.tsx
// Onoma Lab — Stash Section (Facet Rebuild — Side-by-Side)

import { useState } from "react";
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
import type { NameCategory, ExploreSubTab, StudioSubTab } from "~/lib/onoma/types";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

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

  // Queries for stashing
  const stashesQuery = api.wikios.getStashes.useQuery();

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
      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        {/* Sub-tab Toggle buttons */}
        <SegmentedControl
          size="sm"
          asTabs
          aria-label="Stash view"
          value={stashTab}
          onValueChange={setStashTab}
          options={[
            { value: "saved", label: "Saved Items" },
            { value: "lexicon", label: "Lexicon Dictionary" },
            { value: "history", label: "Generation History" },
          ]}
        />

        {stashTab === "saved" && (
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            {/* Upload .txt files (one dictionary per file) */}
            <ImportStashPanel />

            {/* Folder filter dropdown */}
            <div className="relative w-full sm:w-44">
              <Select value={selectedStashFilterId} onValueChange={setSelectedStashFilterId}>
                <SelectTrigger className="text-footnote w-full">
                  <SelectValue placeholder="All Folders" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all" className="text-footnote">
                    📁 All Folders
                  </SelectItem>
                  {stashesQuery.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-footnote">
                      📁 {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="text-label-secondary absolute top-2 left-3 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search saved items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-footnote w-full pr-4 pl-9"
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
                <h3 className="text-label-secondary text-subhead">
                  Saved Names ({savedNames.length})
                </h3>
              </div>

              {savedNames.length > 0 ? (
                <div className="grid max-h-[600px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
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
                            {/* Move to another stash folder */}
                            <Popover
                              open={isStashingThis}
                              onOpenChange={(open) => setStashNameId(open ? entry.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant={isStashingThis ? "tinted" : "plain"}
                                  size="icon-sm"
                                  onClick={(ev) => ev.stopPropagation()}
                                  title="Move to another stash folder"
                                  aria-label="Move to another stash folder"
                                >
                                  <FolderPlus />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                className="w-56 p-2"
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <div className="border-separator mb-1 flex items-center justify-between border-b px-2 py-2">
                                  <span className="text-subhead text-label-secondary">
                                    Stash folders
                                  </span>
                                  <Badge variant="tinted">Global</Badge>
                                </div>
                                {stashesQuery.isLoading && (
                                  <div className="text-label-secondary text-footnote flex items-center gap-2 px-2 py-2">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Loading stashes...</span>
                                  </div>
                                )}
                                {stashesQuery.data && stashesQuery.data.length === 0 && (
                                  <div className="text-label-secondary text-footnote px-2 py-2">
                                    No stash folders found.
                                  </div>
                                )}
                                <div className="max-h-36 space-y-0.5 overflow-y-auto">
                                  {stashesQuery.data?.map((s) => (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      key={s.id}
                                      disabled={stashingFolderId !== null}
                                      onClick={() =>
                                        handleStashName(entry.id, nameValue, s.id, s.name)
                                      }
                                      className="text-label w-full justify-between px-2 text-left font-normal"
                                    >
                                      <span className="flex items-center gap-2 truncate">
                                        <span
                                          className="size-2 shrink-0 rounded-full"
                                          style={{ backgroundColor: s.color }}
                                        />
                                        <span className="truncate">{s.name}</span>
                                      </span>
                                      {stashingFolderId === s.id && (
                                        <Loader2 className="text-label-secondary size-3.5 animate-spin" />
                                      )}
                                    </Button>
                                  ))}
                                </div>
                                {stashFeedback && (
                                  <div className="bg-tint-fill text-tint text-caption rounded-control-sm mt-2 px-2 py-1 text-center">
                                    {stashFeedback}
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>

                            {/* Delete */}
                            <Button
                              variant="plain"
                              size="icon-sm"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDelete(entry.id);
                              }}
                              title="Delete saved name"
                              aria-label="Delete saved name"
                              className="text-label-secondary hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="border-separator text-label-secondary rounded-row text-footnote border border-dashed p-8 text-center">
                  No matching saved names.
                </div>
              )}
            </div>

            {/* Right Column (5/12): Saved Dictionaries */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-label-secondary text-subhead">
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
                <div className="border-separator text-label-secondary rounded-row text-footnote border border-dashed p-8 text-center">
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
