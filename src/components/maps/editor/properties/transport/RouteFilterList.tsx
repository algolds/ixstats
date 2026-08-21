"use client";

import React, { memo } from "react";
import { Search, Pencil, Trash2, Route, Mountain, Gauge } from "lucide-react";
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
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter country routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-border/40 bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading transit network...</div>
      ) : filteredRoutes.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
          {searchQuery ? "No routes matching filter" : "No transport routes recorded yet"}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {filteredRoutes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            const style = (ROUTE_STYLES as any)[route.type] ?? { label: route.type, color: "#94a3b8" };

            return (
              <div
                key={route.id}
                onClick={() => onSelectRouteId?.(isSelected ? null : route.id)}
                className={`group flex items-center justify-between rounded-md border p-2 text-xs transition cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/40 bg-card/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: style.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{route.name}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{style.label}</span>
                      {route.lengthKm && (
                        <span>• {route.lengthKm.toFixed(1)} km</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEditRoute && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRoute(route.id);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
