"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FeatureContextMenu } from "~/components/maps/editor/FeatureContextMenu";
import type {
  EditorContextMenuData,
  MapEditorInstance,
  EditorFeature,
} from "../types/editor-state";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";

interface EditorContextMenuWrapperProps {
  contextMenu: EditorContextMenuData | null;
  setContextMenu: (menu: EditorContextMenuData | null) => void;
  editor: MapEditorInstance;
  /** Confirming delete (falls back to an immediate delete when omitted). */
  onDeleteFeature?: (feature: EditorFeature) => void;
  onZoomToFeature?: (feature: EditorFeature) => void;
}

export function EditorContextMenuWrapper({
  contextMenu,
  setContextMenu,
  editor,
  onDeleteFeature,
  onZoomToFeature,
}: EditorContextMenuWrapperProps) {
  const router = useRouter();

  if (!contextMenu) return null;
  const target = editor.allFeatures.find((f: EditorFeature) => f.id === contextMenu.feature.id);
  const wikiTitle =
    contextMenu.feature.wikiPageTitle ??
    (typeof target?.properties?.wikiPageTitle === "string"
      ? target.properties.wikiPageTitle
      : null);
  const wikiSource =
    contextMenu.feature.wikiSource ??
    (typeof target?.properties?.wikiSource === "string" ? target.properties.wikiSource : null);

  return (
    <FeatureContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      feature={contextMenu.feature}
      onEdit={() => {
        const feat = editor.allFeatures.find((f: EditorFeature) => f.id === contextMenu.feature.id);
        if (feat) editor.startEditing(feat);
        setContextMenu(null);
      }}
      onDuplicate={() => {
        const feat = editor.allFeatures.find((f: EditorFeature) => f.id === contextMenu.feature.id);
        if (feat && editor.duplicateFeature) {
          void editor.duplicateFeature(feat);
        }
        setContextMenu(null);
      }}
      onDelete={() => {
        if (target) {
          if (onDeleteFeature) onDeleteFeature(target);
          else void editor.handleDeleteFeature(target);
        }
        setContextMenu(null);
      }}
      onZoomTo={
        target && onZoomToFeature
          ? () => {
              onZoomToFeature(target);
              setContextMenu(null);
            }
          : undefined
      }
      onCopyCoords={
        target?.coordinates
          ? () => {
              const c = target.coordinates!;
              void navigator.clipboard?.writeText(`${c[1].toFixed(5)}, ${c[0].toFixed(5)}`);
              setContextMenu(null);
            }
          : undefined
      }
      onOpenWiki={
        wikiTitle
          ? () => {
              router.push(wikiReaderPath(wikiTitle, parseWikiSource(wikiSource)));
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
