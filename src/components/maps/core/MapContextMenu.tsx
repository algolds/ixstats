"use client";

/**
 * The world map's part of the system context menu: a right-click (or long-press) on the map reads the place
 * under it and offers what to do there. Spread `useMapContextArea(...)` on the element that wraps the map
 * itself, not the controls and panels around it (they keep the ordinary menu).
 */

import type { RefObject } from "react";
import {
  Copy,
  EditPencil,
  Globe,
  Home,
  Link,
  MapPin,
  Position,
  Ruler,
  ZoomIn,
} from "iconoir-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useOpenCountryActions } from "~/components/shared/country-actions/CountryActionsProvider";
import {
  useContextArea,
  type ContextPoint,
} from "~/components/shared/context-menu/SystemContextMenu";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useNotify } from "~/hooks/useNotify";
import { CONTEXT_SURFACE_ATTR } from "~/lib/navigation/context-target";
import { formatLatLng, mapViewLink } from "~/lib/maps/map-view-link";
import type { IxWorldMapRef, SelectedCountry } from "./IxWorldMap";
import { isPointOnGlobeOrMap, pickCountry } from "./utils/world-map-hit-testing";

export interface MapContextOptions {
  mapRef: RefObject<IxWorldMapRef | null>;
  visibleLayers: ReadonlySet<string>;
  onWhatsHere: (lng: number, lat: number) => void;
  onMeasureFrom: (start: [number, number]) => void;
  onSelectCountry: (country: SelectedCountry) => void;
  onResetView: () => void;
  /** Present when the viewer may edit their nation's borders. */
  onEditMap?: () => void;
  /** Present when the viewer may edit this realm's world. */
  onOpenWorldEditor?: () => void;
}

/** The canvas pixel under a viewport point, or null when the point is off the map or off the globe's disc. */
function canvasPoint(map: MapLibreMap, { x, y }: ContextPoint): { x: number; y: number } | null {
  const rect = map.getCanvas().getBoundingClientRect();
  const pt = { x: x - rect.left, y: y - rect.top };
  if (pt.x < 0 || pt.y < 0 || pt.x > rect.width || pt.y > rect.height) return null;
  return isPointOnGlobeOrMap(map, pt) ? pt : null;
}

export function useMapContextArea(o: MapContextOptions) {
  const notify = useNotify();
  const openCountry = useOpenCountryActions();

  const copy = (text: string, done: string) => {
    navigator.clipboard.writeText(text).then(
      () => notify.success(done),
      () => notify.error("Could not copy", "The browser blocked clipboard access.")
    );
  };

  const area = useContextArea((_target, point) => {
    const map = o.mapRef.current?.getMap();
    if (!map) return null;
    const pt = canvasPoint(map, point);
    if (!pt) {
      return (
        <DropdownMenuItem onSelect={o.onResetView}>
          <Home aria-hidden />
          Reset view
        </DropdownMenuItem>
      );
    }
    const { lng, lat } = map.unproject([pt.x, pt.y]);
    const country = pickCountry(map, [pt.x, pt.y]);
    const name = country?.displayName;
    const editHere = (open: () => void) => () => {
      map.jumpTo({ center: [lng, lat] });
      open();
    };
    const viewLink = () =>
      mapViewLink(window.location.href, {
        lng,
        lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        layers: [...o.visibleLayers],
      });

    return (
      <>
        <DropdownMenuLabel className="tabular-nums">
          {formatLatLng(lng, lat)}
          {name ? ` · ${name}` : ""}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => o.onWhatsHere(lng, lat)}>
          <MapPin aria-hidden />
          What&apos;s here
        </DropdownMenuItem>
        {country?.countryId && (
          <DropdownMenuItem onSelect={() => openCountry({ id: country.countryId!, name })}>
            <Globe aria-hidden />
            Open {name}
          </DropdownMenuItem>
        )}
        {country && (
          <DropdownMenuItem onSelect={() => o.onSelectCountry(country)}>
            <ZoomIn aria-hidden />
            Zoom to {name}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => map.easeTo({ center: [lng, lat] })}>
          <Position aria-hidden />
          Center here
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => o.onMeasureFrom([lng, lat])}>
          <Ruler aria-hidden />
          Measure from here
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => copy(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, "Coordinates copied")}
        >
          <Copy aria-hidden />
          Copy coordinates
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(viewLink(), "Link copied")}>
          <Link aria-hidden />
          Copy link to this view
        </DropdownMenuItem>
        {o.onEditMap && (
          <DropdownMenuItem onSelect={editHere(o.onEditMap)}>
            <EditPencil aria-hidden />
            Edit my borders here
          </DropdownMenuItem>
        )}
        {o.onOpenWorldEditor && (
          <DropdownMenuItem onSelect={editHere(o.onOpenWorldEditor)}>
            <Globe aria-hidden />
            Open the world editor here
          </DropdownMenuItem>
        )}
      </>
    );
  });
  return { ...area, [CONTEXT_SURFACE_ATTR]: "" };
}
