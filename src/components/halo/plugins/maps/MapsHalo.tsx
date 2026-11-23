"use client";

/**
 * MapsHalo: the world map's Halo plugin. "On this page" commands for the map's tools and views, and a place
 * search (countries, cities, regions, points of interest in the realm the map shows) that flies the map there.
 */

import type * as React from "react";
import {
  Bank,
  EditPencil,
  Globe,
  HelpCircle,
  Hexagon,
  Home,
  Label,
  Map as MapIcon,
  MapPin,
  SelectFace3d,
  Play,
  Position,
  Ruler,
} from "iconoir-react";
import { useDIPlugin } from "~/components/halo/plugin-context";
import type { PluginCommand } from "~/components/halo/types";
import type { ProjectionMode } from "~/lib/maps/map-config";
import { api } from "~/trpc/react";

/** A place the map search found (`geoCore.searchFeatures`). */
export interface MapSearchResult {
  type: string;
  id: string;
  name: string;
  countryId: string | null;
  centroidLng: number;
  centroidLat: number;
}

type Icon = React.ComponentType<{ className?: string }>;

const PLACE_KIND: Record<string, { icon: Icon; label: string }> = {
  country: { icon: Globe, label: "Country" },
  city: { icon: MapPin, label: "City" },
  subdivision: { icon: Hexagon, label: "Region" },
  poi: { icon: Bank, label: "Point of interest" },
};

const PROJECTIONS: { mode: ProjectionMode; title: string; icon: Icon }[] = [
  { mode: "globe", title: "Show the globe", icon: Globe },
  { mode: "mercator", title: "Show a flat map", icon: MapIcon },
  { mode: "dynamic", title: "Switch projection automatically", icon: Position },
];

export interface MapsHaloProps {
  realm?: string;
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  labelsVisible: boolean;
  onToggleLabels: () => void;
  onToggleMeasure: () => void;
  onTogglePin: () => void;
  onResetView: () => void;
  onOpenHelp: () => void;
  onSearchResult: (result: MapSearchResult) => void;
  /** Present when the tour is offered (Ixnay's map). */
  onStartTour?: () => void;
  /** Present when the viewer may edit their nation's borders. */
  onEditMap?: () => void;
  /** Present when the viewer may edit this realm's world. */
  onOpenWorldEditor?: () => void;
  /** Present when the realm has an elevation model: whether 3D terrain is on. */
  terrainOn?: boolean;
  onToggleTerrain?: () => void;
}

const cmd = (
  key: string,
  title: string,
  icon: Icon,
  run: () => void,
  keywords: readonly string[],
  description?: string
): PluginCommand => ({ key, title, icon, run, keywords, description });

/** The map's commands for the viewer's current view and powers. */
export function mapCommands(p: Omit<MapsHaloProps, "realm" | "onSearchResult">): PluginCommand[] {
  const commands = [
    cmd("measure", "Measure distance or area", Ruler, p.onToggleMeasure, [
      "measure",
      "distance",
      "area",
      "ruler",
    ]),
    cmd(
      "pin",
      "What's here",
      MapPin,
      p.onTogglePin,
      ["pin", "point", "elevation", "climate", "info"],
      "Drop a pin to read a place"
    ),
    cmd("labels", p.labelsVisible ? "Hide labels" : "Show labels", Label, p.onToggleLabels, [
      "labels",
      "names",
      "text",
    ]),
    cmd("reset", "Reset view", Home, p.onResetView, ["reset", "home", "world", "zoom out"]),
    ...PROJECTIONS.filter(({ mode }) => mode !== p.projectionMode).map(({ mode, title, icon }) =>
      cmd(`projection-${mode}`, title, icon, () => p.onProjectionChange(mode), [
        "projection",
        "globe",
        "flat",
        mode,
      ])
    ),
    cmd("help", "Map help", HelpCircle, p.onOpenHelp, ["help", "welcome", "guide"]),
  ];
  if (p.terrainOn !== undefined && p.onToggleTerrain) {
    commands.push(
      cmd(
        "terrain",
        p.terrainOn ? "Turn off 3D terrain" : "Turn on 3D terrain",
        SelectFace3d,
        p.onToggleTerrain,
        ["3d", "terrain", "relief", "tilt", "elevation", "mountains"]
      )
    );
  }
  if (p.onStartTour)
    commands.push(cmd("tour", "Take the tour", Play, p.onStartTour, ["tour", "guide", "showcase"]));
  if (p.onEditMap)
    commands.push(
      cmd("edit", "Edit my borders", EditPencil, p.onEditMap, [
        "edit",
        "borders",
        "provinces",
        "territory",
      ])
    );
  if (p.onOpenWorldEditor) {
    commands.push(
      cmd("world", "Open the world editor", Globe, p.onOpenWorldEditor, [
        "world",
        "editor",
        "generate",
        "terrain",
      ])
    );
  }
  return commands;
}

export function MapsHalo({ realm, onSearchResult, ...rest }: MapsHaloProps) {
  const utils = api.useUtils();
  const search = async (query: string): Promise<PluginCommand[]> => {
    const places = await utils.geoCore.searchFeatures.fetch({ query, limit: 8, realm });
    return places.map((place) => {
      const kind = PLACE_KIND[place.type] ?? PLACE_KIND.poi!;
      return {
        key: `place-${place.type}-${place.id}`,
        title: place.name,
        description: kind.label,
        icon: kind.icon,
        run: () => onSearchResult(place),
      };
    });
  };
  useDIPlugin({
    // The realm is in the id: Halo keys a plugin's search hits by it.
    id: `maps:${realm ?? "default"}`,
    priority: 5,
    commands: mapCommands(rest),
    search,
  });
  return null;
}
