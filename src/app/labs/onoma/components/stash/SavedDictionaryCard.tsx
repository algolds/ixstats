"use client";

// src/app/labs/onoma/components/stash/SavedDictionaryCard.tsx
// Onoma Custom Studio Workshop — Saved Dictionary Card Component

import { useState } from "react";
import {
  Globe,
  Lock,
  NavArrowUp as ChevronUp,
  NavArrowDown as ChevronDown,
  Wrench,
  FolderPlus,
  EditPencil as Pencil,
  Download,
  Trash as Trash2,
  SystemRestart as Loader2,
  SoundHigh as AudioLines,
  GitFork,
  Sparks as Sparkles,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { useNameBank } from "~/hooks/useNameBank";
import type { NameCategory, ExploreSubTab, StudioSubTab } from "~/lib/onoma/types";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { MenuButton } from "~/components/ui/menu-button";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

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
  const [stashFeedback, setStashFeedback] = useState<string | null>(null);

  // Stash queries
  const stashesQuery = api.wikios.getStashes.useQuery();

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
      variant="inset"
      padding="none"
      className="p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
    >
      <div className="space-y-2">
        {/* Header & Meta Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-label text-footnote truncate font-semibold">{dict.title}</h4>
            <div className="text-label-secondary text-caption mt-0.5 flex items-center gap-2">
              <span>{wordsCount} words</span>
              {dict.category && (
                <>
                  <span>•</span>
                  <span className="capitalize">{dict.category}</span>
                </>
              )}
            </div>
          </div>

          <div className="text-caption flex flex-wrap items-center gap-2">
            <Badge variant={dict.isPublic ? "success" : "neutral"}>
              {dict.isPublic ? (
                <>
                  <Globe />
                  <span>Public</span>
                </>
              ) : (
                <>
                  <Lock />
                  <span>Private</span>
                </>
              )}
            </Badge>
            {dict.role && (
              <Badge variant="tinted" className="capitalize">
                {dict.role}
                {dict.gender && dict.gender !== "any" ? ` · ${dict.gender}` : ""}
              </Badge>
            )}
            {dict.setName && <Badge variant="neutral">⚇ {dict.setName}</Badge>}
            {dict.clonedFromId && (
              <>
                <span>•</span>
                <span className="text-tint/80 font-semibold">Cloned</span>
              </>
            )}
            {dict.stashName && (
              <>
                <span>•</span>
                <span
                  className="rounded-control-sm text-caption inline-flex items-center gap-1 px-2 py-0.5 font-semibold select-none"
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
        <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          {/* Primary Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Expand Button */}
            <Button
              variant="gray"
              size="sm"
              onClick={onToggleExpand}

              title={isExpanded ? "Hide word list" : "Show word list"}
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span>Words</span>
            </Button>

            {/* Load to Studio / Generate */}
            {onLoadToStudio && (
              <Button
                variant="tinted"
                size="sm"
                onClick={() => onLoadToStudio(dict.values, dict.title)}

                title="Load into Studio Workshop"
              >
                <Wrench className="h-3 w-3" />
                <span>Studio</span>
              </Button>
            )}

            {/* Quick Cross-System Actions */}
            {onNavigateExplore && (
              <Button
                variant="tinted"
                size="sm"
                onClick={() => onNavigateExplore("phonology", dict.values, dict.title)}
                title="Inspect IPA acoustics & compare profile"
              >
                <AudioLines className="h-3 w-3" />
                <span className="hidden sm:inline">Compare</span>
              </Button>
            )}

            {onNavigateStudio && (
              <Button
                variant="tinted"
                size="sm"
                onClick={() => onNavigateStudio("shifts", dict.values, dict.title)}

                title="Evolve words in Historical Sound Shifts"
              >
                <GitFork className="h-3 w-3" />
                <span className="hidden sm:inline">Shifts</span>
              </Button>
            )}

            {onNavigateExplore && (
              <Button
                variant="tinted"
                size="sm"
                onClick={() => onNavigateExplore("writing", dict.values, dict.title)}
                title="Typeset words in Writing Systems"
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">Script</span>
              </Button>
            )}

            {/* Move to another stash folder */}
            <Popover open={isStashingThis} onOpenChange={setIsStashingThis}>
              <PopoverTrigger asChild>
                <Button
                  variant={isStashingThis ? "tinted" : "gray"}
                  size="sm"
                  title="Move dictionary to another stash folder"
                >
                  <FolderPlus />
                  <span>Move</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2">
                <div className="border-separator mb-1 flex items-center justify-between border-b px-2 py-2">
                  <span className="text-subhead text-label-secondary">Stash folders</span>
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
                      onClick={() => handleMoveFolder(s.id, s.name)}
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
          </div>

          {/* Secondary Utilities */}
          <div className="flex items-center gap-2">
            {/* Edit (rename / re-tag) */}
            <Button
              variant="gray"
              size="icon-sm"
              onClick={() => onEdit(dict)}
              aria-label="Edit dictionary"
              title="Edit dictionary (rename, role, set)"
            >
              <Pencil />
            </Button>

            {/* Export */}
            <MenuButton
              size="icon-sm"
              label={<Download />}
              aria-label="Export dictionary"
              title="Export dictionary"
              align="end"
            >
              {(["txt", "csv", "json"] as const).map((fmt) => (
                <DropdownMenuItem
                  key={fmt}
                  onSelect={() => handleExport(dict.title, dict.values, fmt)}
                >
                  {fmt.toUpperCase()}
                </DropdownMenuItem>
              ))}
            </MenuButton>

            {/* Delete */}
            <Button
              variant="gray"
              size="icon-sm"
              onClick={() => onDelete(dict.id)}
              aria-label="Delete dictionary"
              title="Delete dictionary"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded list of words */}
      {isExpanded && (
        <div className="border-separator text-footnote border-t pt-2">
          <p className="text-label-secondary line-clamp-3 font-mono leading-normal">
            {previewWords || "No words inside."}
            {wordsCount > 12 && " ..."}
          </p>
        </div>
      )}
    </FacetCard>
  );
}

export default SavedDictionaryCard;
