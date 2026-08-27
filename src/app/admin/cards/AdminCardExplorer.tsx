"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  Eye,
  EyeClosed as EyeOff,
  Component as Layers,
  ControlSlider as SlidersHorizontal,
  Xmark as X,
  ArrowSeparateVertical as ArrowUpDown,
  EditPencil as Edit2,
  Check,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { CardRarity } from "@prisma/client";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import { FacetDataTable, type FacetColumn } from "~/components/ui/data-table";
import { IIWikiBadge, isIIWikiCard } from "~/components/cards/display";
import { CategoryIcon } from "~/components/cards/icons";
import {
  LoreCategory,
  ArtworkSource,
  BROWSABLE_CATEGORIES,
  isValidLoreCategory,
} from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import type { CardInstance } from "~/types/cards-display";

const PAGE_SIZE = 25;

type CardTypeFilter = "all" | "NS_IMPORT" | "USER_CUSTOM" | "LORE_BATCH" | "COMMONS_IMPORT";
type SortByOption = "recent" | "marketValue" | "marketValue_asc" | "name" | "rarity";

interface AdminCardExplorerProps {
  initialCategory?: LoreCategory | "all";
}

export function AdminCardExplorer({ initialCategory = "all" }: AdminCardExplorerProps = {}) {
  const notify = useNotify();

  const [search, setSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<LoreCategory | "all">(initialCategory);
  const [cteFilter, setCteFilter] = useState<"all" | "cte_only" | "active_only">("all");
  const [takedownFilter, setTakedownFilter] = useState<"all" | "visible" | "takedown">("all");
  const [season, setSeason] = useState<number | "all">("all");
  const [rarity, setRarity] = useState<CardRarity | "all">("all");
  const [sortBy, setSortBy] = useState<SortByOption>("recent");
  const [offset, setOffset] = useState(0);

  // Sync category filter if initialCategory changes
  React.useEffect(() => {
    if (initialCategory) {
      setCategoryFilter(initialCategory);
    }
  }, [initialCategory]);

  // 3D Card Modal Viewer state
  const [selectedCardForViewer, setSelectedCardForViewer] = useState<CardInstance | null>(null);

  // Live Card Studio / Edit Modal state
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<CardInstance | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<LoreCategory | "">("");
  const [editCardType, setEditCardType] = useState<string>("LORE");
  const [editRarity, setEditRarity] = useState<CardRarity>("COMMON");
  const [editArtworkUrl, setEditArtworkUrl] = useState("");
  const [editArtworkSource, setEditArtworkSource] = useState<ArtworkSource>("PROCEDURAL");
  const [editMarketValue, setEditMarketValue] = useState(0);
  const [editIsRetired, setEditIsRetired] = useState(false);

  const handleOpen3DViewer = (card: any) => {
    const artUrl = card.artworkUrl || card.artwork || card.wikiImageUrl || "";
    const isWikiCard =
      card.cardType === "LORE" ||
      card.cardType === "LORE_BATCH" ||
      Boolean(card.category && card.category !== "NS_IMPORT") ||
      Boolean(card.wikiPageId) ||
      Boolean(card.wikiSource) ||
      Boolean(card.slug);

    const initialArtSource: ArtworkSource =
      card.artworkSource && card.artworkSource !== "PROCEDURAL"
        ? card.artworkSource
        : artUrl
          ? "WIKI_FETCHED"
          : "PROCEDURAL";

    const instance: CardInstance = {
      ...card,
      artwork: artUrl,
      artworkUrl: artUrl,
      artworkSource: initialArtSource,
      cardType: isWikiCard ? "LORE" : card.cardType || "NS_IMPORT",
      category:
        card.category && card.category !== "NS_IMPORT"
          ? (card.category as LoreCategory)
          : isWikiCard
            ? "NATION"
            : undefined,
    };

    setSelectedCardForViewer(instance);
  };

  const handleOpenEditModal = (card: any) => {
    const artUrl = card.artworkUrl || card.artwork || card.wikiImageUrl || "";
    const isWikiCard =
      card.cardType === "LORE" ||
      card.cardType === "LORE_BATCH" ||
      Boolean(card.category && card.category !== "NS_IMPORT") ||
      Boolean(card.wikiPageId) ||
      Boolean(card.wikiSource) ||
      Boolean(card.slug);

    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'initialCategory' is intentional in this scope
    const initialCategory: LoreCategory | "" =
      card.category && card.category !== "NS_IMPORT"
        ? (card.category as LoreCategory)
        : isWikiCard
          ? "NATION"
          : "";

    const initialCardType = isWikiCard
      ? "LORE"
      : card.cardType || (card.nsCardId ? "NS_IMPORT" : "LORE");

    const initialArtSource: ArtworkSource =
      card.artworkSource && card.artworkSource !== "PROCEDURAL"
        ? card.artworkSource
        : artUrl
          ? "WIKI_FETCHED"
          : "PROCEDURAL";

    const instance: CardInstance = {
      ...card,
      artwork: artUrl,
      artworkUrl: artUrl,
      cardType: initialCardType,
      category: initialCategory || undefined,
      artworkSource: initialArtSource,
    };

    setSelectedCardForEdit(instance);
    setEditTitle(card.title || "");
    setEditCategory(initialCategory);
    setEditCardType(initialCardType);
    setEditRarity(card.rarity || "COMMON");
    setEditArtworkUrl(artUrl);
    setEditArtworkSource(initialArtSource);
    setEditMarketValue(card.marketValue || 0);
    setEditIsRetired(card.isRetired || false);
  };

  const livePreviewCard = React.useMemo(() => {
    if (!selectedCardForEdit) return null;
    return {
      ...selectedCardForEdit,
      title: editTitle,
      category: editCategory || undefined,
      cardType: editCardType,
      rarity: editRarity,
      artworkUrl: editArtworkUrl,
      artwork: editArtworkUrl,
      artworkSource: editArtworkSource,
      marketValue: editMarketValue,
      isRetired: editIsRetired,
    } as CardInstance;
  }, [
    selectedCardForEdit,
    editTitle,
    editCategory,
    editCardType,
    editRarity,
    editArtworkUrl,
    editArtworkSource,
    editMarketValue,
    editIsRetired,
  ]);

  // Inline edit state tracking
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueNum, setEditingValueNum] = useState<number>(0);

  // Bulk visibility control states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetType, setBulkTargetType] = useState<
    "all" | "NS_IMPORT" | "LORE" | "USER_CUSTOM" | "COMMONS_IMPORT"
  >("all");
  const [bulkCteFilter, setBulkCteFilter] = useState<"all" | "active" | "cte">("all");
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<"all" | LoreCategory>("all");
  const [bulkSeason, setBulkSeason] = useState<"all" | "1" | "2" | "3">("all");
  const [bulkRarity, setBulkRarity] = useState<"all" | CardRarity>("all");

  const bulkVisibilityMutation = api.cards.bulkToggleVisibility.useMutation({
    onSuccess: (data) => {
      notify.success("Bulk Update Complete", data.message);
      setIsBulkModalOpen(false);
      void refetch();
    },
    onError: (err) => {
      notify.error("Bulk Update Failed", err.message);
    },
  });

  const queryInput = {
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
    categoryFilter: categoryFilter !== "all" ? categoryFilter : undefined,
    cardTypeFilter,
    season: season !== "all" ? season : undefined,
    rarity: rarity !== "all" ? rarity : undefined,
    cteFilter,
    isRetired:
      takedownFilter === "takedown" ? true : takedownFilter === "visible" ? false : undefined,
    includeRetired: takedownFilter === "all" ? true : undefined,
    sortBy,
  };

  const {
    data,
    isLoading,
    isFetching: _isFetching,
    refetch,
  } = api.cards.getNSCards.useQuery(queryInput);

  const updateDetailsMutation = api.cards.updateCardDetails.useMutation({
    onSuccess: () => {
      notify.success("Card updated", "Card details updated successfully.");
      setEditingTitleId(null);
      setEditingValueId(null);
      void refetch();
    },
    onError: (err) => {
      notify.error("Update failed", err.message);
    },
  });

  const total = data?.total ?? 0;
  const cards = data?.cards ?? [];
  const _totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const isFiltered =
    search !== "" ||
    categoryFilter !== "all" ||
    cardTypeFilter !== "all" ||
    cteFilter !== "all" ||
    takedownFilter !== "all" ||
    season !== "all" ||
    rarity !== "all" ||
    sortBy !== "recent";

  const resetAllFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setCardTypeFilter("all");
    setCteFilter("all");
    setTakedownFilter("all");
    setSeason("all");
    setRarity("all");
    setSortBy("recent");
    setOffset(0);
  };

  const getCardTypeBadge = (card: {
    cardType?: string | null;
    nsCardId?: number | null;
    category?: string | null;
    wikiSource?: string | null;
    wikiPageId?: number | null;
    wikiExcerpt?: string | null;
    slug?: string | null;
  }) => {
    const isWiki =
      card.cardType === "LORE" ||
      card.cardType === "LORE_BATCH" ||
      Boolean(card.category) ||
      Boolean(card.wikiSource) ||
      Boolean(card.wikiPageId) ||
      Boolean(card.slug) ||
      Boolean(card.wikiExcerpt);

    const isIIWiki = isIIWikiCard(card as any);

    if (
      isIIWiki ||
      (isWiki && (!card.nsCardId || card.cardType === "LORE" || card.cardType === "LORE_BATCH"))
    ) {
      if (isIIWiki) {
        return <IIWikiBadge size="xs" />;
      }
      return (
        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-500 backdrop-blur-md dark:text-amber-300">
          Wiki
        </span>
      );
    }

    if (card.cardType === "COMMONS_IMPORT") {
      return (
        <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/15 px-2 py-0.5 text-[9px] font-bold text-teal-600 backdrop-blur-md dark:text-teal-300">
          Commons Import
        </span>
      );
    }

    if (
      card.nsCardId !== null &&
      card.nsCardId !== undefined &&
      card.nsCardId > 0 &&
      card.cardType === "NS_IMPORT"
    ) {
      return (
        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[9px] font-bold text-blue-600 backdrop-blur-md dark:text-blue-300">
          NS Import
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold text-cyan-600 backdrop-blur-md dark:text-cyan-300">
        User Imported
      </span>
    );
  };

  const handleSaveTitle = (cardId: string) => {
    if (!editingTitleValue.trim()) return;
    updateDetailsMutation.mutate({ cardId, title: editingTitleValue.trim() });
  };

  const handleSaveValue = (cardId: string) => {
    if (editingValueNum < 0) return;
    updateDetailsMutation.mutate({ cardId, marketValue: editingValueNum });
  };

  const handleToggleTakedown = (cardId: string, currentStatus: boolean) => {
    updateDetailsMutation.mutate({ cardId, isRetired: !currentStatus });
  };

  const handleSaveModalCard = () => {
    if (!selectedCardForEdit) return;
    updateDetailsMutation.mutate({
      cardId: selectedCardForEdit.id,
      title: editTitle,
      category: (editCategory as LoreCategory) || undefined,
      cardType: editCardType,
      rarity: editRarity,
      artworkUrl: editArtworkUrl || null,
      artworkSource: editArtworkSource,
      marketValue: editMarketValue,
      isRetired: editIsRetired,
    });
    setSelectedCardForEdit(null);
  };

  // oxlint-disable-next-line
  const columns = useMemo<FacetColumn<any>[]>(
    () => [
      {
        key: "art",
        header: "Card",
        mobileRole: "hero",
        render: (_val: unknown, card: any) => {
          const rawUrl = card.artworkUrl || card.artwork || card.wikiImageUrl;
          const proxiedUrl = rawUrl ? proxyCardArtwork(rawUrl) : null;
          return (
            <button
              type="button"
              onClick={() => handleOpen3DViewer(card)}
              title="Click to view interactive 3D card"
              className="border-border bg-muted/60 hover:border-primary/60 group/thumb relative flex h-11 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-md border shadow-xs transition-all hover:scale-110 hover:shadow-md active:scale-95"
            >
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-1">
                <CategoryIcon category={card.category || "SPECIAL"} treatment="seal" />
              </div>
              {proxiedUrl && (
                <img
                  src={proxiedUrl}
                  alt={card.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              )}
            </button>
          );
        },
      },
      {
        key: "title",
        header: "Title",
        mobileRole: "hero",
        accessor: (card: any) => card.title,
        render: (_val: unknown, card: any) => {
          const isEditingTitle = editingTitleId === card.id;
          if (isEditingTitle) {
            return (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  value={editingTitleValue}
                  onChange={(e) => setEditingTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle(card.id);
                    else if (e.key === "Escape") setEditingTitleId(null);
                  }}
                  className="border-primary bg-card text-foreground h-7 w-full rounded-lg border px-2 text-xs font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveTitle(card.id)}
                  disabled={updateDetailsMutation.isPending}
                  className="rounded-md bg-emerald-500/20 p-1 text-emerald-600 hover:bg-emerald-500/30 dark:text-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditingTitleId(null)}
                  className="rounded-md bg-rose-500/20 p-1 text-rose-600 hover:bg-rose-500/30 dark:text-rose-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          return (
            <div className="group/title flex items-center justify-between gap-2">
              <div>
                <div className="text-foreground max-w-[180px] truncate font-semibold">
                  {card.title}
                </div>
                <div className="text-muted-foreground font-mono text-[10px]">
                  {card.nsCardId ? `NS ID: ${card.nsCardId}` : `ID: ${card.id.slice(0, 8)}`}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTitleId(card.id);
                  setEditingTitleValue(card.title);
                }}
                className="text-muted-foreground hover:text-primary hover:bg-accent rounded p-1 opacity-0 transition-all group-hover/title:opacity-100"
                title="Edit Title"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          );
        },
      },
      {
        key: "origin",
        header: "Origin",
        mobileRole: "badge",
        render: (_val: unknown, card: any) => getCardTypeBadge(card),
      },
      {
        key: "rarity",
        header: "Season & Rarity",
        mobileRole: "badge",
        render: (_val: unknown, card: any) => (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-600 backdrop-blur-md dark:text-purple-300">
              S{card.season}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 backdrop-blur-md dark:text-amber-300">
              {card.rarity}
            </span>
          </div>
        ),
      },
      {
        key: "marketValue",
        header: "Value",
        sortable: true,
        mobileRole: "field",
        mobileLabel: "Market Value",
        accessor: (card: any) => card.marketValue || 0,
        render: (_val: unknown, card: any) => {
          const isEditingValue = editingValueId === card.id;
          if (isEditingValue) {
            return (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  value={editingValueNum}
                  onChange={(e) => setEditingValueNum(parseInt(e.target.value, 10) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveValue(card.id);
                    else if (e.key === "Escape") setEditingValueId(null);
                  }}
                  className="border-primary bg-card text-foreground h-7 w-20 rounded-lg border px-2 text-xs font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveValue(card.id)}
                  disabled={updateDetailsMutation.isPending}
                  className="rounded-md bg-emerald-500/20 p-1 text-emerald-600 hover:bg-emerald-500/30 dark:text-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditingValueId(null)}
                  className="rounded-md bg-rose-500/20 p-1 text-rose-600 hover:bg-rose-500/30 dark:text-rose-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          return (
            <div className="group/val flex items-center gap-2">
              <span className="text-foreground font-semibold">
                {(card.marketValue || 0).toLocaleString()}{" "}
                <span className="text-muted-foreground text-[9px]">CR</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingValueId(card.id);
                  setEditingValueNum(card.marketValue || 0);
                }}
                className="text-muted-foreground hover:text-primary hover:bg-accent rounded p-1 opacity-0 transition-all group-hover/val:opacity-100"
                title="Edit Value"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          );
        },
      },
      {
        key: "category",
        header: "Category / Status",
        mobileRole: "field",
        render: (_val: unknown, card: any) => {
          const meta = (card.metadata as Record<string, any>) || {};
          const isCTE = meta.isCTE === true;
          const cardTypeStr = (card.cardType as string) || "";
          const isLoreCard =
            cardTypeStr === "LORE" ||
            cardTypeStr === "LORE_BATCH" ||
            Boolean(card.wikiPageId) ||
            Boolean(card.wikiSource) ||
            Boolean(card.wikiArticleTitle) ||
            Boolean(card.slug) ||
            (card.category && card.category !== "NS_IMPORT");

          const resolvedCategory = (
            card.category && isValidLoreCategory(card.category) && card.category !== "NS_IMPORT"
              ? (card.category as LoreCategory)
              : isLoreCard
                ? classifyFromWikitext(
                    (meta?.fullExcerpt as string) || card.description,
                    card.wikiArticleTitle || card.title
                  )
                : null
          ) as LoreCategory | null;

          if (isLoreCard) {
            return (
              <div className="bg-primary/10 border-primary/20 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 backdrop-blur-md">
                <CategoryIcon category={resolvedCategory || "SPECIAL"} treatment="seal" size="xs" />
                <span className="text-primary text-[10px] font-bold">
                  {resolvedCategory ? getCategoryLabel(resolvedCategory) : "Lore"}
                </span>
              </div>
            );
          }
          if (isCTE) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 backdrop-blur-md dark:text-rose-300">
                <AlertTriangle className="h-3 w-3 text-rose-500" />
                CTE (Defunct)
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 backdrop-blur-md dark:text-emerald-300">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              Active Nation
            </span>
          );
        },
      },
      {
        key: "visibility",
        header: "Takedown / Visibility",
        mobileRole: "field",
        render: (_val: unknown, card: any) => {
          const isRetired = card.isRetired === true;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTakedown(card.id, isRetired);
              }}
              disabled={updateDetailsMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                isRetired
                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 dark:text-amber-300"
                  : "bg-muted/80 border-border text-muted-foreground hover:bg-accent hover:text-foreground border"
              }`}
              title="Click to toggle visibility / takedown state"
            >
              {isRetired ? (
                <>
                  <EyeOff className="h-3 w-3 text-amber-500" />
                  Hidden (Click to Restore)
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 text-emerald-500" />
                  Visible (Click to Hide)
                </>
              )}
            </button>
          );
        },
      },
      {
        key: "actions",
        header: "Studio & Edit",
        align: "right",
        mobileRole: "action",
        render: (_val: unknown, card: any) => (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal(card);
            }}
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 h-7 rounded-lg text-[11px] font-semibold shadow-xs transition-all active:scale-95"
          >
            <Eye className="mr-1 h-3 w-3" /> Edit Studio
          </Button>
        ),
      },
    ],
    [
      editingTitleId,
      editingTitleValue,
      editingValueId,
      editingValueNum,
      updateDetailsMutation.isPending,
    ]
  );

  return (
    <FacetCard
      depth={2}
      className="border-border bg-card/70 text-card-foreground space-y-6 rounded-2xl border p-6 shadow-xl backdrop-blur-xl"
    >
      {/* ─── Facet & Apple Design Header Section ────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="border-primary/30 bg-primary/10 rounded-xl border p-2.5 backdrop-blur-md">
            <SlidersHorizontal className="text-primary h-5 w-5" />
          </div>
          <div>
            <h3 className="text-foreground text-xl font-bold tracking-tight">Card Explorer</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsBulkModalOpen(true)}
            className="border-primary/30 bg-primary/20 text-primary hover:bg-primary/30 h-8 rounded-xl border text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Bulk Visibility Controls
          </Button>
          <span className="border-border bg-card/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Layers className="text-primary h-3.5 w-3.5" />
            Showing <strong className="text-foreground">{cards.length}</strong> of{" "}
            <strong className="text-foreground">{total.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* ─── Apple Design Filter Toolbar ─────────────────────────── */}
      <FacetContainer
        depth={1}
        enableRefraction={true}
        className="bg-card/60 border-border flex flex-wrap items-center gap-2.5 rounded-2xl border p-3.5 shadow-sm backdrop-blur-xl"
      >
        {/* Search Input */}
        <div className="relative max-w-md min-w-[220px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Search title, nation, or keyword..."
            className="border-border bg-card/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-8.5 rounded-xl pl-8 text-xs transition-all focus:ring-1"
          />
        </div>

        {/* Card Source / Importer Filter */}
        <select
          value={cardTypeFilter}
          onChange={(e) => {
            setCardTypeFilter(e.target.value as CardTypeFilter);
            setOffset(0);
          }}
          className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
        >
          <option value="all" className="bg-background text-foreground">
            All Card Sources
          </option>
          <option value="LORE_BATCH" className="bg-background text-foreground">
            Wiki Lore Cards
          </option>
          <option value="NS_IMPORT" className="bg-background text-foreground">
            NS Official Imports
          </option>
          <option value="USER_CUSTOM" className="bg-background text-foreground">
            User Imported / Custom
          </option>
          <option value="COMMONS_IMPORT" className="bg-background text-foreground">
            Commons Flag Imports
          </option>
        </select>

        {/* Lore Category Filter */}
        {cardTypeFilter !== "NS_IMPORT" && (
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as any);
              setOffset(0);
            }}
            className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
          >
            <option value="all" className="bg-background text-foreground">
              All Lore Categories
            </option>
            {Object.values(LoreCategory).map((cat) => (
              <option key={cat} value={cat} className="bg-background text-foreground">
                {cat} — {getCategoryLabel(cat)}
              </option>
            ))}
          </select>
        )}

        {/* CTE Status Filter */}
        {cardTypeFilter !== "LORE_BATCH" && (
          <select
            value={cteFilter}
            onChange={(e) => {
              setCteFilter(e.target.value as any);
              setOffset(0);
            }}
            className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
          >
            <option value="all" className="bg-background text-foreground">
              All Nation Statuses
            </option>
            <option value="active_only" className="bg-background text-foreground">
              Active Nations Only
            </option>
            <option value="cte_only" className="bg-background text-foreground">
              CTE Defunct Only
            </option>
          </select>
        )}

        {/* Takedown Filter */}
        <select
          value={takedownFilter}
          onChange={(e) => {
            setTakedownFilter(e.target.value as any);
            setOffset(0);
          }}
          className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
        >
          <option value="all" className="bg-background text-foreground">
            All Takedown States
          </option>
          <option value="visible" className="bg-background text-foreground">
            Visible Cards Only
          </option>
          <option value="takedown" className="bg-background text-foreground">
            Takedowns / Hidden
          </option>
        </select>

        {/* Season Selector */}
        <select
          value={season.toString()}
          onChange={(e) => {
            setSeason(e.target.value === "all" ? "all" : parseInt(e.target.value, 10));
            setOffset(0);
          }}
          className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
        >
          <option value="all" className="bg-background text-foreground">
            All Seasons
          </option>
          <option value="1" className="bg-background text-foreground">
            Season 1
          </option>
          <option value="2" className="bg-background text-foreground">
            Season 2
          </option>
          <option value="3" className="bg-background text-foreground">
            Season 3
          </option>
        </select>

        {/* Rarity Selector */}
        <select
          value={rarity}
          onChange={(e) => {
            setRarity(e.target.value as any);
            setOffset(0);
          }}
          className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
        >
          <option value="all" className="bg-background text-foreground">
            All Rarities
          </option>
          <option value="COMMON" className="bg-background text-foreground">
            Common
          </option>
          <option value="UNCOMMON" className="bg-background text-foreground">
            Uncommon
          </option>
          <option value="RARE" className="bg-background text-foreground">
            Rare
          </option>
          <option value="ULTRA_RARE" className="bg-background text-foreground">
            Ultra Rare
          </option>
          <option value="EPIC" className="bg-background text-foreground">
            Epic
          </option>
          <option value="LEGENDARY" className="bg-background text-foreground">
            Legendary
          </option>
        </select>

        {/* Sort By Selector */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px] font-medium">
            <ArrowUpDown className="h-3 w-3" /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortByOption);
              setOffset(0);
            }}
            className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
          >
            <option value="recent" className="bg-background text-foreground">
              Newest First
            </option>
            <option value="marketValue" className="bg-background text-foreground">
              Market Value (High to Low)
            </option>
            <option value="marketValue_asc" className="bg-card text-card-foreground">
              Market Value (Low to High)
            </option>
            <option value="name" className="bg-card text-card-foreground">
              Title (A-Z)
            </option>
          </select>

          {isFiltered && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetAllFilters}
              className="h-8.5 rounded-xl px-2.5 text-xs font-medium text-rose-500 transition-all hover:bg-rose-500/10 hover:text-rose-600 active:scale-95"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </FacetContainer>

      {/* ─── Facet Data Table ──────────────────────────────────────── */}
      <FacetDataTable
        data={cards}
        columns={columns}
        paginated
        pageSize={PAGE_SIZE}
        page={currentPage}
        totalCount={total}
        onPageChange={(p) => setOffset((p - 1) * PAGE_SIZE)}
        loading={isLoading}
        emptyMessage="No cards match these active filters"
        urlSync={true}
        urlPrefix="card_"
      />

      {/* ─── Granular Bulk Visibility Controls Modal ────────────────── */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="border-border bg-card text-card-foreground max-w-lg border shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-bold">
              <EyeOff className="text-primary h-5 w-5" />
              Granular Bulk Visibility Controls
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Perform bulk visibility updates across all cards or target specific card origins,
              nation statuses, rarities, or seasons.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Quick 1-Click Global Toggles */}
            <div className="border-primary/20 bg-primary/5 space-y-2 rounded-xl border p-3">
              <div className="text-foreground text-xs font-semibold">
                1-Click Global NS Card Actions
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    bulkVisibilityMutation.mutate({
                      isRetired: true,
                      cardTypeFilter: "NS_IMPORT",
                    })
                  }
                  disabled={bulkVisibilityMutation.isPending}
                  className="h-8 flex-1 rounded-lg border border-rose-500/30 bg-rose-500/20 text-xs font-semibold text-rose-600 hover:bg-rose-500/30 dark:text-rose-300"
                >
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide All NS Cards
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    bulkVisibilityMutation.mutate({
                      isRetired: false,
                      cardTypeFilter: "NS_IMPORT",
                    })
                  }
                  disabled={bulkVisibilityMutation.isPending}
                  className="h-8 flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/30 dark:text-emerald-300"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Restore All NS Cards
                </Button>
              </div>
            </div>

            {/* Granular Filtering Selector */}
            <div className="space-y-3 pt-1">
              <div className="text-foreground text-xs font-semibold">
                Granular Criteria Selection
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Target Source */}
                <div>
                  <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                    Card Origin / Type
                  </label>
                  <select
                    value={bulkTargetType}
                    onChange={(e) => setBulkTargetType(e.target.value as any)}
                    className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">
                      All Card Types
                    </option>
                    <option value="NS_IMPORT" className="bg-card text-card-foreground">
                      NS Import Only
                    </option>
                    <option value="LORE" className="bg-card text-card-foreground">
                      Lore Cards Only
                    </option>
                    <option value="USER_CUSTOM" className="bg-card text-card-foreground">
                      User Custom Only
                    </option>
                    <option value="COMMONS_IMPORT" className="bg-card text-card-foreground">
                      Commons Import Only
                    </option>
                  </select>
                </div>

                {/* Nation Status or Lore Category */}
                {bulkTargetType === "LORE" ? (
                  <div>
                    <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                      Lore Category
                    </label>
                    <select
                      value={bulkCategoryFilter}
                      onChange={(e) => setBulkCategoryFilter(e.target.value as any)}
                      className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                    >
                      <option value="all" className="bg-card text-card-foreground">
                        All Lore Categories
                      </option>
                      {Object.values(LoreCategory).map((cat) => (
                        <option key={cat} value={cat} className="bg-card text-card-foreground">
                          {cat} — {getCategoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                      Nation Status
                    </label>
                    <select
                      value={bulkCteFilter}
                      onChange={(e) => setBulkCteFilter(e.target.value as any)}
                      className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                    >
                      <option value="all" className="bg-card text-card-foreground">
                        All Statuses
                      </option>
                      <option value="active" className="bg-card text-card-foreground">
                        Active Nations Only
                      </option>
                      <option value="cte" className="bg-card text-card-foreground">
                        Defunct (CTE) Only
                      </option>
                    </select>
                  </div>
                )}

                {/* Season */}
                <div>
                  <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                    Card Season
                  </label>
                  <select
                    value={bulkSeason}
                    onChange={(e) => setBulkSeason(e.target.value as any)}
                    className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">
                      All Seasons
                    </option>
                    <option value="1" className="bg-card text-card-foreground">
                      Season 1
                    </option>
                    <option value="2" className="bg-card text-card-foreground">
                      Season 2
                    </option>
                    <option value="3" className="bg-card text-card-foreground">
                      Season 3
                    </option>
                  </select>
                </div>

                {/* Rarity */}
                <div>
                  <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                    Card Rarity
                  </label>
                  <select
                    value={bulkRarity}
                    onChange={(e) => setBulkRarity(e.target.value as any)}
                    className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">
                      All Rarities
                    </option>
                    <option value="COMMON" className="bg-card text-card-foreground">
                      Common
                    </option>
                    <option value="UNCOMMON" className="bg-card text-card-foreground">
                      Uncommon
                    </option>
                    <option value="RARE" className="bg-card text-card-foreground">
                      Rare
                    </option>
                    <option value="ULTRA_RARE" className="bg-card text-card-foreground">
                      Ultra Rare
                    </option>
                    <option value="EPIC" className="bg-card text-card-foreground">
                      Epic
                    </option>
                    <option value="LEGENDARY" className="bg-card text-card-foreground">
                      Legendary
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                bulkVisibilityMutation.mutate({
                  isRetired: true,
                  cardTypeFilter: bulkTargetType,
                  cteFilter: bulkCteFilter,
                  categoryFilter: bulkCategoryFilter,
                  season: bulkSeason,
                  rarity: bulkRarity,
                })
              }
              disabled={bulkVisibilityMutation.isPending}
              className="bg-rose-500 font-semibold text-white hover:bg-rose-600"
            >
              Hide Selected Cards
            </Button>
            <Button
              onClick={() =>
                bulkVisibilityMutation.mutate({
                  isRetired: false,
                  cardTypeFilter: bulkTargetType,
                  cteFilter: bulkCteFilter,
                  categoryFilter: bulkCategoryFilter,
                  season: bulkSeason,
                  rarity: bulkRarity,
                })
              }
              disabled={bulkVisibilityMutation.isPending}
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              Restore Selected Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Live Card Studio & Inspector Modal ──────────────────────── */}
      {selectedCardForEdit && livePreviewCard && (
        <Dialog
          open={!!selectedCardForEdit}
          onOpenChange={(open) => !open && setSelectedCardForEdit(null)}
        >
          <DialogContent className="border-border bg-card text-card-foreground max-h-[90vh] max-w-4xl overflow-y-auto border shadow-2xl backdrop-blur-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-xl font-bold">
                <SlidersHorizontal className="text-primary h-5 w-5" />
                Lore Card Studio & Inspector
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Inspect live card rendering, customize categories, rarity materials, artwork
                sources, and market values in real time.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6 py-4 md:grid-cols-12">
              {/* Left Column: Live Card Display */}
              <div className="border-border flex flex-col items-center justify-center rounded-2xl border bg-black/40 p-6 backdrop-blur-md md:col-span-5">
                <div className="text-muted-foreground mb-4 flex items-center gap-1.5 text-xs font-semibold">
                  <Eye className="text-primary h-3.5 w-3.5" /> Live Card Face Preview
                </div>
                <CardDisplay card={livePreviewCard} size="medium" enable3D={true} />
              </div>

              {/* Right Column: Interactive Editor Form */}
              <div className="space-y-4 md:col-span-7">
                {/* Origin & Title */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-foreground mb-1 block text-xs font-semibold">
                      Card Origin / Type
                    </label>
                    <select
                      value={editCardType}
                      onChange={(e) => setEditCardType(e.target.value)}
                      className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                    >
                      <option value="LORE">Wiki Lore Card (Wiki)</option>
                      <option value="NS_IMPORT">NationStates Import (NS Import)</option>
                      <option value="COMMONS_IMPORT">Commons Flag Import (Commons)</option>
                      <option value="USER_CUSTOM">User Custom Import (Custom)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-foreground mb-1 block text-xs font-semibold">
                      Card Title
                    </label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Article title..."
                      className="border-border bg-card text-foreground h-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Lore Category */}
                <div>
                  <label className="text-foreground mb-1 block flex items-center justify-between text-xs font-semibold">
                    <span>Lore Category</span>
                    <span className="text-muted-foreground text-[10px] font-normal">
                      Sets background theme & icon watermark
                    </span>
                  </label>
                  <select
                    value={editCategory === "NS_IMPORT" ? "" : editCategory}
                    onChange={(e) => setEditCategory(e.target.value as LoreCategory)}
                    className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                  >
                    <option value="">(Default / Unassigned)</option>
                    {BROWSABLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} — {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rarity & Market Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-foreground mb-1 block text-xs font-semibold">
                      Rarity Tier
                    </label>
                    <select
                      value={editRarity}
                      onChange={(e) => setEditRarity(e.target.value as CardRarity)}
                      className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                    >
                      <option value="COMMON">COMMON</option>
                      <option value="UNCOMMON">UNCOMMON</option>
                      <option value="RARE">RARE</option>
                      <option value="ULTRA_RARE">ULTRA RARE</option>
                      <option value="EPIC">EPIC</option>
                      <option value="LEGENDARY">LEGENDARY</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-foreground mb-1 block text-xs font-semibold">
                      Est. Market Value (IxC)
                    </label>
                    <Input
                      type="number"
                      value={editMarketValue}
                      onChange={(e) => setEditMarketValue(parseInt(e.target.value, 10) || 0)}
                      className="border-border bg-card text-foreground h-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Artwork Source & URL */}
                <div className="space-y-2">
                  <div>
                    <label className="text-foreground mb-1 block text-xs font-semibold">
                      Artwork Source Tier
                    </label>
                    <select
                      value={editArtworkSource}
                      onChange={(e) => setEditArtworkSource(e.target.value as ArtworkSource)}
                      className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                    >
                      <option value="PROCEDURAL">
                        Tier 1-2: Procedural Icon Emblem (No Image)
                      </option>
                      <option value="WIKI_FETCHED">Tier 3: Wiki Fetched Image</option>
                      <option value="FLAG">Tier 3: National Flag Artwork</option>
                      <option value="UPLOADED">Tier 3: Admin Custom Upload</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-foreground mb-1 block text-xs font-semibold">
                      Artwork URL
                    </label>
                    <Input
                      value={editArtworkUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        setEditArtworkUrl(url);
                        if (url.trim() && editArtworkSource === "PROCEDURAL") {
                          setEditArtworkSource("WIKI_FETCHED");
                        }
                      }}
                      placeholder="https://... image URL (optional)"
                      className="border-border bg-card text-foreground h-9 font-mono text-xs text-[11px]"
                    />
                  </div>
                </div>

                {/* Visibility / Takedown Toggle */}
                <div className="border-border bg-card/60 flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-foreground text-xs font-semibold">
                      Card Visibility Status
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Hidden cards are retired from packs & marketplace.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditIsRetired(!editIsRetired)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      editIsRetired
                        ? "border border-rose-500/30 bg-rose-500/20 text-rose-500"
                        : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-500"
                    }`}
                  >
                    {editIsRetired ? "Hidden / Retired" : "Visible"}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setSelectedCardForEdit(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveModalCard}
                disabled={updateDetailsMutation.isPending}
                className="bg-primary text-primary-foreground font-semibold hover:opacity-90"
              >
                Save Card Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── 3D Card Full Viewer Modal ────────────────────────────── */}
      <CardDetailsModal
        card={selectedCardForViewer}
        open={Boolean(selectedCardForViewer)}
        onClose={() => setSelectedCardForViewer(null)}
      />
    </FacetCard>
  );
}
