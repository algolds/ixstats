// @ts-nocheck
"use client";

import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pencil, Copy, Trash2, MapPin, ExternalLink, BookOpen } from "lucide-react";

interface FeatureContextMenuProps {
  x: number;
  y: number;
  feature: {
    id: string;
    name: string;
    type: string;
    wikiPageTitle?: string | null;
  };
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyCoords?: () => void;
  onOpenWiki?: () => void;
  onClose: () => void;
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

  const primaryItems: MenuItem[] = [
    { label: "Edit Properties", icon: Pencil, onClick: onEdit },
    { label: "Duplicate", icon: Copy, onClick: onDuplicate },
    { label: "Delete", icon: Trash2, onClick: onDelete, danger: true },
  ];

  const secondaryItems: MenuItem[] = [];

  if (onCopyCoords) {
    secondaryItems.push({
      label: "Copy Coordinates",
      icon: MapPin,
      onClick: onCopyCoords,
    });
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

  // Clamp position to viewport
  const menuWidth = 192;
  const menuHeight = (primaryItems.length + secondaryItems.length + 1) * 32 + 8;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  const renderItem = (item: MenuItem) => (
    <button
      key={item.label}
      onClick={() => {
        item.onClick();
        onClose();
      }}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
        item.danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-neutral-200 hover:bg-neutral-700 hover:text-white"
      }`}
    >
      <item.icon className="h-3.5 w-3.5 shrink-0" />
      <span>{item.label}</span>
    </button>
  );

  return createPortal(
    <div
      data-context-menu
      className="fixed z-[9999] min-w-[192px] overflow-hidden rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
      style={{ left: clampedX, top: clampedY }}
    >
      {primaryItems.map(renderItem)}

      {secondaryItems.length > 0 && (
        <>
          <div className="mx-2 my-1 h-px bg-neutral-700" />
          {secondaryItems.map(renderItem)}
        </>
      )}
    </div>,
    document.body
  );
});
