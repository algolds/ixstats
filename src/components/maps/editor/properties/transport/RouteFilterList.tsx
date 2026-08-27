"use client";

import React, { memo } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import { Search, EditPencil as Pencil, Trash as Trash2, ModernTv as Mountain } from "iconoir-react";
import { ROUTE_STYLES } from "~/lib/maps/map-config";

interface RouteItem {
  id: string;
  name: string;
  type: string;
  status: string;
  lengthKm?: number;
  elevationGainM?: number;
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
  const filteredRoutes = routes.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
        <input
          type="text"
          placeholder="Filter country routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-md border py-1.5 pr-3 pl-8 text-xs focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-6 text-center text-xs">
          Loading transit network...
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-md border border-dashed py-6 text-center text-xs">
          {searchQuery ? "No routes matching filter" : "No transport routes recorded yet"}
        </div>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {filteredRoutes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            const style = (ROUTE_STYLES as any)[route.type] ?? {
              label: route.type,
              color: "#94a3b8",
            };

            return (
              <div
                key={route.id}
                onClick={() => onSelectRouteId?.(isSelected ? null : route.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition ${
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/40 bg-card/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: style.color }}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{route.name}</div>
                    <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                      <span>{style.label}</span>
                      {route.lengthKm && <span>• {route.lengthKm.toFixed(1)} km</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {onEditRoute && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRoute(route.id);
                      }}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
                      title="Edit Route Path"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDeleteRoute && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRoute(route.id);
                      }}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1"
                      title="Delete Route"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
