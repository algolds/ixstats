"use client";

import { FacetMaterial } from "~/components/ui/facet";
import React, { useEffect, useCallback } from "react";
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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  const primaryItems: MenuItem[] = [];
  const secondaryItems: MenuItem[] = [];

  if (feature.type === "gap") {
    if (onCreateFromGap) {
      primaryItems.push({
        label: "Create Region from Gap",
        icon: Plus,
        onClick: onCreateFromGap,
      });
    }
  } else {
    primaryItems.push(
      { label: "Edit Properties", icon: Pencil, onClick: onEdit },
      { label: "Duplicate", icon: Copy, onClick: onDuplicate }
    );
    if (onZoomTo) primaryItems.push({ label: "Zoom To", icon: ZoomIn, onClick: onZoomTo });

    if (feature.type === "city" && onSplitCity) {
      primaryItems.push({
        label: "Split City",
        icon: Scissors,
        onClick: onSplitCity,
      });
    }

    primaryItems.push({ label: "Delete", icon: Trash2, onClick: onDelete, danger: true });

    if (onCopyCoords) {
      secondaryItems.push({
        label: "Copy Coordinates",
        icon: MapPin,
        onClick: onCopyCoords,
      });
    }

    if (feature.type === "city") {
      if (onSnapToBorder) {
        secondaryItems.push({
          label: "Snap to Nearest Border",
          icon: MapPin,
          onClick: onSnapToBorder,
        });
      }
      if (onSnapToCoast) {
        secondaryItems.push({
          label: "Snap to Coastline",
          icon: MapPin,
          onClick: onSnapToCoast,
        });
      }
    }

    if (feature.wikiPageTitle && onOpenWiki) {
      secondaryItems.push({
        label: "Open Wiki Page",
        icon: ExternalLink,
        onClick: onOpenWiki,
      });
    }

    if (!feature.wikiPageTitle) {
      secondaryItems.push({
        label: "Link to Wiki",
        icon: BookOpen,
        onClick: onEdit,
      });
    }
  }

  // Clamp position to viewport
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
      className={`text-caption flex w-full items-center gap-2 px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 active:scale-[0.98] ${
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
        material="thick"
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
