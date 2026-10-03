"use client";

import { Button } from "~/components/ui/button";
import React, { memo } from "react";
import { Search, EditPencil as Pencil, Trash as Trash2 } from "iconoir-react";
import { ROUTE_STYLES } from "~/lib/maps/map-config";
import { calculateRouteTravelTime } from "~/lib/economy/travel-time";

interface RouteItem {
  id: string;
  name: string;
  type: string;
  status: string;
  lengthKm?: number;
  elevationGainM?: number;
  speedKmh?: number | null;
  properties?: Record<string, unknown> | null;
}

interface RouteFilterListProps {
  routes: RouteItem[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedRouteId?: string | null;
  onSelectRouteId?: (id: string | null) => void;
  onEditRoute?: (id: string) => void;
  onDeleteRoute?: (id: string) => void;
}

export const RouteFilterList = memo(function RouteFilterList({
  routes,
  isLoading,
  searchQuery,
  setSearchQuery,
  selectedRouteId,
  onSelectRouteId,
  onEditRoute,
  onDeleteRoute,
}: RouteFilterListProps) {
  const query = searchQuery.trim().toLowerCase();
  const filteredRoutes = React.useMemo(() => {
    if (!query) return routes;
    return routes.filter((r) => r.name.toLowerCase().includes(query));
  }, [routes, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-label-secondary absolute top-3 left-3 h-3.5 w-3.5" />
        <input
          type="text"
          placeholder="Filter country routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-separator bg-surface text-label placeholder:text-label-secondary focus:border-tint rounded-control-sm text-footnote w-full border py-2 pr-3 pl-8 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-label-secondary text-footnote py-6 text-center">
          Loading transit network...
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="border-separator text-label-secondary rounded-control-sm text-footnote border border-dashed py-6 text-center">
          {searchQuery ? "No routes matching filter" : "No transport routes recorded yet"}
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filteredRoutes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            const style = ROUTE_STYLES[route.type] ?? {
              label: route.type,
              color: "var(--color-slate-400)",
            };

            const travelDuration =
              route.lengthKm !== undefined
                ? calculateRouteTravelTime({
                    lengthKm: route.lengthKm,
                    speedKmh:
                      route.speedKmh ??
                      (route.properties as { speed_kmh?: number } | null)?.speed_kmh,
                    routeType: route.type,
                  }).formattedTime
                : null;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRouteId?.(isSelected ? null : route.id)}
                className={`group rounded-control-sm text-footnote flex cursor-pointer items-center justify-between border p-2 transition ${
                  isSelected
                    ? "border-tint bg-tint-fill text-label"
                    : "border-separator bg-surface hover:bg-fill-4"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: style.color }}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{route.name}</div>
                    <div className="text-label-secondary text-footnote flex items-center gap-2">
                      <span>{style.label}</span>
                      {route.lengthKm !== undefined && (
                        <span className="tabular-nums">• {route.lengthKm.toFixed(1)} km</span>
                      )}
                      {travelDuration && (
                        <span className="text-tint font-medium tabular-nums">
                          • {travelDuration}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {onEditRoute && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-label-secondary h-6 w-6"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRoute(route.id);
                      }}
                      title="Edit route path"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDeleteRoute && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRoute(route.id);
                      }}
                      title="Delete route"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
