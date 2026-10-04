"use client";

import { FacetMaterial } from "~/components/ui/facet";
import React, { useEffect } from "react";
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-context-menu]")) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

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

  const menuWidth = 208;
  const menuHeight = (primaryItems.length + secondaryItems.length + 1) * 32 + 8;
  const clampedX =
    typeof window !== "undefined" ? Math.min(x, window.innerWidth - menuWidth - 8) : x;
  const clampedY =
    typeof window !== "undefined" ? Math.min(y, window.innerHeight - menuHeight - 8) : y;

  const renderItem = (item: MenuItem) => (
    <button
      key={item.label}
      role="menuitem"
      onClick={() => {
        item.onClick();
        onClose();
      }}
      className={`text-caption flex w-full items-center gap-2 px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity] duration-100 ${
        item.danger
          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
          : "text-label hover:bg-fill-3"
      }`}
    >
      <item.icon className="text-label-secondary h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{item.label}</span>
    </button>
  );

  return createPortal(
    <div
      data-context-menu
      className="animate-in fade-in zoom-in-95 z-popover fixed min-w-[208px] origin-top-left duration-100"
      style={{ left: clampedX, top: clampedY }}
    >
      <FacetMaterial
        layer="overlay"
        role="menu"
        aria-label={`${feature.name} actions`}
        className="rounded-row overflow-hidden py-2"
      >
        {primaryItems.map(renderItem)}

        {secondaryItems.length > 0 && (
          <>
            <div className="bg-separator mx-2 my-1 h-px" />
            {secondaryItems.map(renderItem)}
          </>
        )}
      </FacetMaterial>
    </div>,
    document.body
  );
});
