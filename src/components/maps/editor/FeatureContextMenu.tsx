"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  EditPencil as Pencil,
  Copy,
  Trash as Trash2,
  MapPin,
  OpenNewWindow as ExternalLink,
  OpenBook as BookOpen,
  Plus,
  Cut as Scissors,
  ZoomIn,
} from "iconoir-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import type { ContextMenuFeature } from "./types/editor-state";

interface FeatureContextMenuProps {
  x: number;
  y: number;
  feature: ContextMenuFeature;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyCoords?: () => void;
  onOpenWiki?: () => void;
  onClose: () => void;
  onCreateFromGap?: () => void;
  onSnapToBorder?: () => void;
  onSnapToCoast?: () => void;
  onSplitCity?: () => void;
  onZoomTo?: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
}

export const FeatureContextMenu = React.memo(function FeatureContextMenu({
  x,
  y,
  feature,
  onEdit,
  onDuplicate,
  onDelete,
  onCopyCoords,
  onOpenWiki,
  onClose,
  onCreateFromGap,
  onSnapToBorder,
  onSnapToCoast,
  onSplitCity,
  onZoomTo,
}: FeatureContextMenuProps) {
  const isGap = feature.type === "gap";
  const isCity = feature.type === "city";
  const hasWiki = !!feature.wikiPageTitle;
  const items = (list: (MenuItem | false | undefined)[]) => list.filter((i): i is MenuItem => !!i);

  const primaryItems = isGap
    ? items([
        onCreateFromGap && {
          label: "Create region from gap",
          icon: Plus,
          onClick: onCreateFromGap,
        },
      ])
    : items([
        { label: "Edit properties", icon: Pencil, onClick: onEdit },
        { label: "Duplicate", icon: Copy, onClick: onDuplicate },
        onZoomTo && { label: "Zoom to", icon: ZoomIn, onClick: onZoomTo },
        isCity && onSplitCity && { label: "Split city", icon: Scissors, onClick: onSplitCity },
        { label: "Delete", icon: Trash2, onClick: onDelete, danger: true },
      ]);
  const secondaryItems = isGap
    ? []
    : items([
        onCopyCoords && { label: "Copy coordinates", icon: MapPin, onClick: onCopyCoords },
        isCity &&
          onSnapToBorder && {
            label: "Snap to nearest border",
            icon: MapPin,
            onClick: onSnapToBorder,
          },
        isCity &&
          onSnapToCoast && { label: "Snap to coastline", icon: MapPin, onClick: onSnapToCoast },
        hasWiki &&
          onOpenWiki && { label: "Open wiki page", icon: ExternalLink, onClick: onOpenWiki },
        !hasWiki && { label: "Link to wiki", icon: BookOpen, onClick: onEdit },
      ]);

  const renderItem = (item: MenuItem) => (
    <DropdownMenuItem
      key={item.label}
      variant={item.danger ? "destructive" : "default"}
      onSelect={item.onClick}
    >
      <item.icon aria-hidden />
      {item.label}
    </DropdownMenuItem>
  );

  // The map hands over a viewport point, so the menu hangs off a fixed 1px anchor there; Radix
  // then supplies keyboard navigation, typeahead, collision handling and outside-click dismissal.
  return (
    <DropdownMenu key={`${x},${y}`} open modal={false} onOpenChange={(open) => !open && onClose()}>
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed size-px"
            style={{ left: x, top: y }}
          />
        </DropdownMenuTrigger>,
        document.body
      )}
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        aria-label={`${feature.name} actions`}
        aria-labelledby={undefined}
        className="min-w-52"
      >
        {primaryItems.map(renderItem)}
        {secondaryItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {secondaryItems.map(renderItem)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
