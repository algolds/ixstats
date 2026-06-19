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
        const feat = editor.allFeatures.find((f: any) => f.id === contextMenu.feature.id);
        if (feat && editor.duplicateFeature) {
          void editor.duplicateFeature(feat);
        }
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
      onCreateFromGap={() => {
        if (editor.createSubdivisionFromGap) {
          editor.createSubdivisionFromGap(contextMenu.feature.geometry);
        }
        setContextMenu(null);
      }}
      onSnapToBorder={() => {
        if (editor.snapCityToSubdivisionBorder) {
          void editor.snapCityToSubdivisionBorder(contextMenu.feature.id);
        }
        setContextMenu(null);
      }}
      onSnapToCoast={() => {
        if (editor.snapCityToCoastline) {
          void editor.snapCityToCoastline(contextMenu.feature.id);
        }
        setContextMenu(null);
      }}
      onSplitCity={() => {
        if (editor.splitCity) {
          void editor.splitCity(contextMenu.feature.id);
        }
        setContextMenu(null);
      }}
      onClose={() => setContextMenu(null)}
    />
  );
}
