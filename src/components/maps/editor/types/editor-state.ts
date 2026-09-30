"use client";

import type { Geometry } from "geojson";
import type { Prisma } from "@prisma/client";
import type { useMapEditor, EditorFeature, EditorMode, FeatureType } from "~/hooks/useMapEditor";
import type { BorderEditorState, BorderEditorActions } from "~/hooks/useBorderEditor";
import type { TabId } from "~/components/maps/editor/EditorPanel";

export type MapEditorInstance = ReturnType<typeof useMapEditor>;

export type { BorderEditorState, BorderEditorActions, EditorFeature, EditorMode, FeatureType };

export interface ContextMenuFeature {
  id: string;
  name: string;
  type: string;
  wikiPageTitle?: string | null;
  geometry?: Geometry | object | null;
  coordinates?: [number, number];
}

export interface EditorContextMenuData {
  x: number;
  y: number;
  feature: ContextMenuFeature;
}

export type PanelPlacement = "left" | "right" | "bottom";

export interface PanelConfig {
  placement: PanelPlacement;
  collapsed: boolean;
  tabs: TabId[];
}

export interface LayerStateRecord {
  visible: boolean;
  opacity: number;
  locked?: boolean;
}

export type EditorLayerStates = Record<string, LayerStateRecord>;

export interface EditorCountryInfo {
  id?: string;
  name: string;
  flagUrl?: string | null;
}

export interface PropertiesPanelCountry {
  id: string;
  name: string;
}

export interface EditorFeatureDetails {
  id: string;
  featureId: string;
  displayName: string | null;
  countryId: string | null;
  areaSqKm: number | null;
  centroid?: Prisma.JsonValue;
  boundingBox?: Prisma.JsonValue;
  properties?: Prisma.JsonValue;
  wikiPageTitle: string | null;
  countryName: string | null;
  flagUrl?: string | null;
  featureType?: string | null;
  areaKm2?: number | null;
}

export interface SovereigntyRelation {
  id: string;
  sovereignId: string;
  subjectId: string;
  sovereignName: string;
  subjectName: string;
  sovereignFlag?: string | null;
  subjectFlag?: string | null;
  relationshipType: string;
  autonomyLevel: number;
  description?: string | null;
  establishedDate?: string | null;
}

export interface SovereigntyFormData {
  sovereignId: string;
  subjectId: string;
  relationshipType: string;
  autonomyLevel: number;
  description: string;
  establishedDate: string;
}

export interface LinkageIssue {
  type: string;
  countryId: string;
  countryName: string;
  countryFlag?: string | null;
  featureId?: string | null;
  featureName?: string | null;
  description?: string;
  detail?: string;
}

export interface LinkageLinkedItem {
  countryId: string;
  countryName: string;
  countryFlag?: string | null;
  featureId: string;
  featureName: string;
  areaSqKm?: number | null;
  hasOwner: boolean;
  ownerName?: string | null;
}

export interface LinkageUnlinkedItem {
  countryId: string;
  countryName: string;
  countryFlag?: string | null;
  hasGeometry: boolean;
  hasLandArea: boolean;
  hasOwner: boolean;
  ownerName?: string | null;
}

export interface LinkageValidationData {
  totalCountries: number;
  linkedCount: number;
  unlinkedCount: number;
  issueCount: number;
  issues: LinkageIssue[];
  linked: LinkageLinkedItem[];
  unlinked: LinkageUnlinkedItem[];
}
