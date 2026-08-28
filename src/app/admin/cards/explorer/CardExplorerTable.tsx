import React, { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { FacetDataTable, type FacetColumn } from "~/components/ui/data-table";
import {
  WarningTriangle as AlertTriangle,
  CheckCircle,
  Eye,
  EyeClosed as EyeOff,
  EditPencil as Edit2,
  Check,
  Xmark as X,
} from "iconoir-react";
import { IIWikiBadge, isIIWikiCard } from "~/components/cards/display/IIWikiLogo";
import { CategoryIcon } from "~/components/cards/icons";
import { LoreCategory, isValidLoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";

interface CardExplorerTableProps {
  cards: any[];
  total: number;
  offset: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onOpen3DViewer: (card: any) => void;
  onOpenEditModal: (card: any) => void;
  onSaveTitle: (cardId: string, title: string) => void;
  onSaveValue: (cardId: string, value: number) => void;
  onToggleTakedown: (cardId: string, currentStatus: boolean) => void;
  isPending: boolean;
}

export const CardExplorerTable = React.memo(function CardExplorerTable({
  cards,
  total,
  offset,
  pageSize,
  isLoading,
  onPageChange,
  onOpen3DViewer,
  onOpenEditModal,
  onSaveTitle,
  onSaveValue,
  onToggleTakedown,
  isPending,
}: CardExplorerTableProps) {
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueNum, setEditingValueNum] = useState<number>(0);

  const getCardTypeBadge = (card: any) => {
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
              onClick={() => onOpen3DViewer(card)}
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
                    if (e.key === "Enter") {
                      onSaveTitle(card.id, editingTitleValue.trim());
                      setEditingTitleId(null);
                    } else if (e.key === "Escape") setEditingTitleId(null);
                  }}
                  className="border-primary bg-card text-foreground h-7 w-full rounded-lg border px-2 text-xs font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    onSaveTitle(card.id, editingTitleValue.trim());
                    setEditingTitleId(null);
                  }}
                  disabled={isPending}
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
                    if (e.key === "Enter") {
                      onSaveValue(card.id, editingValueNum);
                      setEditingValueId(null);
                    } else if (e.key === "Escape") setEditingValueId(null);
                  }}
                  className="border-primary bg-card text-foreground h-7 w-20 rounded-lg border px-2 text-xs font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    onSaveValue(card.id, editingValueNum);
                    setEditingValueId(null);
                  }}
                  disabled={isPending}
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
                onToggleTakedown(card.id, isRetired);
              }}
              disabled={isPending}
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
              onOpenEditModal(card);
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
      isPending,
      onOpen3DViewer,
      onOpenEditModal,
      onSaveTitle,
      onSaveValue,
      onToggleTakedown,
    ]
  );

  return (
    <FacetDataTable
      data={cards}
      columns={columns}
      loading={isLoading}
      paginated={true}
      pageSize={pageSize}
      page={Math.floor(offset / pageSize) + 1}
      totalCount={total}
      onPageChange={onPageChange}
      emptyMessage="No cards found matching current filters."
    />
  );
});
