"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { FeatureContextMenu } from "~/components/maps/editor/FeatureContextMenu";

interface EditorContextMenuWrapperProps {
  contextMenu: {
    x: number;
    y: number;
    feature: any;
  } | null;
  setContextMenu: (menu: any | null) => void;
  editor: any;
}

export function EditorContextMenuWrapper({
  contextMenu,
  setContextMenu,
  editor,
}: EditorContextMenuWrapperProps) {
  const router = useRouter();

  if (!contextMenu) return null;

  return (
    <FeatureContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      feature={contextMenu.feature}
      onEdit={() => {
        const feat = editor.allFeatures.find((f: any) => f.id === contextMenu.feature.id);
        if (feat) editor.startEditing(feat);
        setContextMenu(null);
      }}
      onDuplicate={() => {
        setContextMenu(null);
      }}
      onDelete={() => {
        editor.handleDeleteFeature(contextMenu.feature.id, contextMenu.feature.type as any);
        setContextMenu(null);
      }}
      onCopyCoords={() => {
        const feat = editor.allFeatures.find((f: any) => f.id === contextMenu.feature.id);
        if (feat && "coordinates" in feat && Array.isArray(feat.coordinates)) {
          navigator.clipboard.writeText(`${feat.coordinates[1]}, ${feat.coordinates[0]}`);
        }
        setContextMenu(null);
      }}
      onOpenWiki={
        contextMenu.feature.wikiPageTitle
          ? () => {
              router.push(titleToWikiOSPath(contextMenu.feature.wikiPageTitle!));
              setContextMenu(null);
            }
          : undefined
      }
      onClose={() => setContextMenu(null)}
    />
  );
}
