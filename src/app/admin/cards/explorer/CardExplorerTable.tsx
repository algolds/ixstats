import React, { useMemo, useState } from "react";
import type { Card, Prisma } from "@prisma/client";
import { cn } from "~/lib/utils";
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
import { getCategoryLabel } from "~/lib/cards/category-theme";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { getCardTypeLabel } from "~/lib/cards/display-utils";
import { CardType } from "~/lib/cards/enums";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { ActionPill } from "~/components/ui/action-pill";

interface CardExplorerTableProps {
  cards: Card[];
  total: number;
  offset: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onOpen3DViewer: (card: Card) => void;
  onOpenEditModal: (card: Card) => void;
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

  const getCardTypeBadge = (card: Card) => {
    if (isIIWikiCard(card)) return <IIWikiBadge size="xs" />;
    return (
      <Badge variant={card.cardType === CardType.LORE ? "warning" : "info"}>
        {getCardTypeLabel(card.cardType)}
      </Badge>
    );
  };

  const columns = useMemo<FacetColumn<Card>[]>(
    () => [
      {
        key: "art",
        header: "Card",
        mobileRole: "hero",
        render: (_val, card: Card) => {
          const rawUrl = card.artwork;
          const proxiedUrl = rawUrl ? proxyCardArtwork(rawUrl) : null;
          return (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpen3DViewer(card)}
              title="Click to view interactive 3D card"
              aria-label={`View ${card.title ?? "card"} as an interactive 3D card`}
              className="border-separator hover:border-tint/60 group/thumb hover:shadow-card h-11 w-8 overflow-hidden border p-0"
            >
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-1">
                <CategoryIcon category={card.category ?? "SPECIAL"} treatment="seal" />
              </div>
              {proxiedUrl && (
                <img
                  src={proxiedUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              )}
            </Button>
          );
        },
      },
      {
        key: "title",
        header: "Title",
        mobileRole: "hero",
        accessor: (card: Card) => card.title,
        render: (_val, card: Card) => {
          const isEditingTitle = editingTitleId === card.id;
          if (isEditingTitle) {
            return (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editingTitleValue}
                  onChange={(e) => setEditingTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSaveTitle(card.id, editingTitleValue.trim());
                      setEditingTitleId(null);
                    } else if (e.key === "Escape") setEditingTitleId(null);
                  }}
                  className="w-full"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    onSaveTitle(card.id, editingTitleValue.trim());
                    setEditingTitleId(null);
                  }}
                  disabled={isPending}
                  aria-label="Save title"
                  className="text-success"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditingTitleId(null)}
                  aria-label="Cancel"
                  className="text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          }
          return (
            <div className="group/title flex items-center justify-between gap-2">
              <div>
                <div className="text-label max-w-[180px] truncate font-semibold">{card.title}</div>
                <div className="text-label-secondary text-footnote font-mono">
                  {card.nsCardId ? `NS ID: ${card.nsCardId}` : `ID: ${card.id.slice(0, 8)}`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit title"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTitleId(card.id);
                  setEditingTitleValue(card.title);
                }}
                className="opacity-0 group-hover/title:opacity-100"
                title="Edit title"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
      {
        key: "origin",
        header: "Origin",
        mobileRole: "badge",
        render: (_val, card: Card) => getCardTypeBadge(card),
      },
      {
        key: "rarity",
        header: "Season & Rarity",
        mobileRole: "badge",
        render: (_val, card: Card) => (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">S{card.season}</Badge>
            <Badge variant="warning">{card.rarity}</Badge>
          </div>
        ),
      },
      {
        key: "marketValue",
        header: "Value",
        sortable: true,
        mobileRole: "field",
        mobileLabel: "Market Value",
        accessor: (card: Card) => card.marketValue || 0,
        render: (_val, card: Card) => {
          const isEditingValue = editingValueId === card.id;
          if (isEditingValue) {
            return (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="number"
                  value={editingValueNum}
                  onChange={(e) => setEditingValueNum(parseInt(e.target.value, 10) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSaveValue(card.id, editingValueNum);
                      setEditingValueId(null);
                    } else if (e.key === "Escape") setEditingValueId(null);
                  }}
                  className="w-20"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    onSaveValue(card.id, editingValueNum);
                    setEditingValueId(null);
                  }}
                  disabled={isPending}
                  aria-label="Save value"
                  className="text-success"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditingValueId(null)}
                  aria-label="Cancel"
                  className="text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          }
          return (
            <div className="group/val flex items-center gap-2">
              <span className="text-label font-semibold">
                {(card.marketValue || 0).toLocaleString()}{" "}
                <span className="text-label-secondary text-footnote">CR</span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit value"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingValueId(card.id);
                  setEditingValueNum(card.marketValue || 0);
                }}
                className="opacity-0 group-hover/val:opacity-100"
                title="Edit value"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
      {
        key: "category",
        header: "Category / Status",
        mobileRole: "field",
        render: (_val, card: Card) => {
          const meta: Prisma.JsonObject = isJsonObject(card.metadata) ? card.metadata : {};
          const isCTE = meta.isCTE === true;
          const isLoreCard =
            card.cardType === CardType.LORE ||
            Boolean(card.wikiSource) ||
            Boolean(card.wikiArticleTitle) ||
            Boolean(card.slug) ||
            Boolean(card.category);

          const resolvedCategory =
            card.category ??
            (isLoreCard
              ? classifyFromWikitext(
                  (meta?.fullExcerpt as string) || card.description,
                  card.wikiArticleTitle || card.title
                )
              : null);

          if (isLoreCard) {
            return (
              <div className="bg-tint-fill border-tint/20 inline-flex items-center gap-2 rounded-full border px-3 py-0.5">
                <CategoryIcon category={resolvedCategory || "SPECIAL"} treatment="seal" size="xs" />
                <span className="text-tint text-caption">
                  {resolvedCategory ? getCategoryLabel(resolvedCategory) : "Lore"}
                </span>
              </div>
            );
          }
          if (isCTE) {
            return (
              <Badge variant="destructive">
                <AlertTriangle className="text-red h-3 w-3" />
                CTE (Defunct)
              </Badge>
            );
          }
          return (
            <Badge variant="success">
              <CheckCircle className="text-green h-3 w-3" />
              Active nation
            </Badge>
          );
        },
      },
      {
        key: "visibility",
        header: "Takedown / Visibility",
        mobileRole: "field",
        render: (_val, card: Card) => {
          const isRetired = card.isRetired === true;
          return (
            <ActionPill
              pressed={isRetired}
              tone="warning"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTakedown(card.id, isRetired);
              }}
              disabled={isPending}
              className={cn(!isRetired && "border-separator border")}
              title="Click to toggle visibility / takedown state"
            >
              {isRetired ? (
                <>
                  <EyeOff aria-hidden />
                  Hidden (Click to Restore)
                </>
              ) : (
                <>
                  <Eye aria-hidden className="text-green" />
                  Visible (Click to Hide)
                </>
              )}
            </ActionPill>
          );
        },
      },
      {
        key: "actions",
        header: "Studio & Edit",
        align: "right",
        mobileRole: "action",
        render: (_val, card: Card) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditModal(card);
            }}
          >
            <Eye className="mr-1 h-3 w-3" /> Edit studio
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
