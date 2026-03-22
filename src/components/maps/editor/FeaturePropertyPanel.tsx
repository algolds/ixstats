"use client";

/**
 * FeaturePropertyPanel - Form panel for editing feature properties.
 * Shows different fields based on the current editor mode.
 * Matches standard map control styling (solid white, no glass).
 */

import { useState } from "react";
import { Check, Loader2, CheckCircle2, Sparkles, Users, TrendingUp, Gem, BookOpen, Trash2, Pencil } from "lucide-react";
import type { EditorMode, CityFormData, SubdivisionFormData, POIFormData } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "./WikiLinkWizard";
import { api } from "~/trpc/react";

interface PointInfo {
  elevation?: {
    zoneName?: string | null;
    elevationLabel?: string | null;
    color?: string | null;
  } | null;
  climate?: {
    climateName?: string | null;
    color?: string | null;
  } | null;
}

interface FeaturePropertyPanelProps {
  mode: EditorMode;
  pendingCoordinates: [number, number] | null;
  pendingGeometry: object | null;
  cityForm: CityFormData;
  onCityFormChange: (form: CityFormData) => void;
  subdivisionForm: SubdivisionFormData;
  onSubdivisionFormChange: (form: SubdivisionFormData) => void;
  poiForm: POIFormData;
  onPOIFormChange: (form: POIFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isMutating: boolean;
  error: { message: string } | null;
  /** Timestamp of last successful save — shows brief success flash */
  lastSavedAt?: number | null;
  /** Terrain info at the pending click point */
  pendingPointInfo?: PointInfo | null;
  isPendingPointInfoLoading?: boolean;
  /** Country ID — needed for transport route generation */
  countryId?: string;
}

const CITY_TYPES = [
  "capital", "city", "town", "village", "hamlet", "port", "fortress",
];

const SUBDIVISION_TYPES = [
  "province", "state", "region", "territory", "district", "county", "department",
];

const POI_CATEGORIES = [
  "landmark", "historical", "natural", "religious", "military", "cultural",
  "economic", "educational", "monument", "ruins",
];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function FeaturePropertyPanel({
  mode,
  pendingCoordinates,
  pendingGeometry,
  cityForm,
  onCityFormChange,
  subdivisionForm,
  onSubdivisionFormChange,
  poiForm,
  onPOIFormChange,
  onSubmit,
  onCancel,
  isMutating,
  error,
  lastSavedAt,
  pendingPointInfo,
  isPendingPointInfoLoading,
  countryId,
}: FeaturePropertyPanelProps) {
  if (mode === "view") return null;

  // Paint mode panel — map mode selector + province stats
  if (mode === "paint") {
    return <PaintModePanel countryId={countryId} onCancel={onCancel} />;
  }

  // Transport route panel — fully self-contained
  if (mode === "add-route") {
    return <TransportPanel countryId={countryId} onCancel={onCancel} />;
  }

  const isEdit = mode.startsWith("edit-");

  const hasLocation =
    isEdit ||
    (mode === "add-city" && pendingCoordinates) ||
    (mode === "add-subdivision" && pendingGeometry) ||
    (mode === "add-poi" && pendingCoordinates);

  const hasName =
    ((mode === "add-city" || mode === "edit-city") && cityForm.name.trim()) ||
    ((mode === "add-subdivision" || mode === "edit-subdivision") && subdivisionForm.name.trim()) ||
    ((mode === "add-poi" || mode === "edit-poi") && poiForm.name.trim());

  const canSubmit = hasLocation && hasName && !isMutating;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {mode === "add-city" && "New City"}
          {mode === "edit-city" && "Edit City"}
          {mode === "add-subdivision" && "New Region"}
          {mode === "edit-subdivision" && "Edit Region"}
          {mode === "add-poi" && "New POI"}
          {mode === "edit-poi" && "Edit POI"}
        </h3>
      </div>

      {/* Location indicator */}
      {!isEdit && !hasLocation && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {mode === "add-subdivision"
            ? "Draw a polygon on the map to define the region boundary"
            : "Click on the map to set the location"}
        </div>
      )}
      {pendingCoordinates && (mode === "add-city" || mode === "add-poi") && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Location: {pendingCoordinates[1].toFixed(3)}&deg;, {pendingCoordinates[0].toFixed(3)}&deg;
        </div>
      )}
      {pendingGeometry && mode === "add-subdivision" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Region polygon drawn
        </div>
      )}

      {/* Terrain info at clicked point */}
      {pendingCoordinates && (mode === "add-city" || mode === "add-poi") && (
        <div className="flex flex-wrap gap-1.5">
          {isPendingPointInfoLoading && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Terrain...
            </span>
          )}
          {pendingPointInfo?.elevation?.zoneName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {pendingPointInfo.elevation.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: pendingPointInfo.elevation.color.slice(0, 7) }}
                />
              )}
              {pendingPointInfo.elevation.zoneName}
              {pendingPointInfo.elevation.elevationLabel && (
                <span className="text-muted-foreground">
                  {pendingPointInfo.elevation.elevationLabel}
                </span>
              )}
            </span>
          )}
          {pendingPointInfo?.climate?.climateName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {pendingPointInfo.climate.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: pendingPointInfo.climate.color }}
                />
              )}
              {pendingPointInfo.climate.climateName}
            </span>
          )}
        </div>
      )}

      {/* City Form */}
      {(mode === "add-city" || mode === "edit-city") && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="City name"
            value={cityForm.name}
            onChange={(e) => onCityFormChange({ ...cityForm, name: e.target.value })}
            className={inputClasses}
            autoFocus
          />
          <select
            value={cityForm.cityType}
            onChange={(e) => onCityFormChange({ ...cityForm, cityType: e.target.value })}
            className={selectClasses}
          >
            {CITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Population (optional)"
            value={cityForm.population ?? ""}
            onChange={(e) =>
              onCityFormChange({
                ...cityForm,
                population: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className={inputClasses}
          />
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={cityForm.isNationalCapital}
              onChange={(e) =>
                onCityFormChange({ ...cityForm, isNationalCapital: e.target.checked })
              }
              className="rounded border-border text-primary focus:ring-primary"
            />
            National capital
          </label>
          <WikiLinkWizard
            value={cityForm.wikiPageTitle}
            onChange={(title) => onCityFormChange({ ...cityForm, wikiPageTitle: title })}
            onImport={(fields) => {
              const updates: Partial<CityFormData> = { wikiPageTitle: fields.wikiPageTitle };
              if (fields.population) updates.population = fields.population;
              onCityFormChange({ ...cityForm, ...updates });
            }}
            currentCoords={pendingCoordinates ?? undefined}
            placeholder="Search wiki to link..."
          />
        </div>
      )}

      {/* Subdivision Form */}
      {(mode === "add-subdivision" || mode === "edit-subdivision") && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Region name"
            value={subdivisionForm.name}
            onChange={(e) => onSubdivisionFormChange({ ...subdivisionForm, name: e.target.value })}
            className={inputClasses}
            autoFocus
          />
          <select
            value={subdivisionForm.type}
            onChange={(e) => onSubdivisionFormChange({ ...subdivisionForm, type: e.target.value })}
            className={selectClasses}
          >
            {SUBDIVISION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Population (optional)"
            value={subdivisionForm.population ?? ""}
            onChange={(e) =>
              onSubdivisionFormChange({
                ...subdivisionForm,
                population: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className={inputClasses}
          />
        </div>
      )}

      {/* POI Form */}
      {(mode === "add-poi" || mode === "edit-poi") && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Name"
            value={poiForm.name}
            onChange={(e) => onPOIFormChange({ ...poiForm, name: e.target.value })}
            className={inputClasses}
            autoFocus
          />
          <select
            value={poiForm.category}
            onChange={(e) => onPOIFormChange({ ...poiForm, category: e.target.value })}
            className={selectClasses}
          >
            {POI_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Description (optional)"
            value={poiForm.description ?? ""}
            onChange={(e) => onPOIFormChange({ ...poiForm, description: e.target.value })}
            rows={2}
            className={inputClasses}
          />
          <WikiLinkWizard
            value={poiForm.wikiPageTitle}
            onChange={(title) => onPOIFormChange({ ...poiForm, wikiPageTitle: title })}
            onImport={(fields) => {
              onPOIFormChange({ ...poiForm, wikiPageTitle: fields.wikiPageTitle });
            }}
            currentCoords={pendingCoordinates ?? undefined}
            placeholder="Search wiki to link..."
          />
        </div>
      )}

      {/* Success flash */}
      {lastSavedAt && !error && (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isEdit ? "Changes saved" : "Saved — click map to place another"}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-3 sm:py-1.5 text-base sm:text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating ? (
            <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
          ) : (
            <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          )}
          {isMutating ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-3 sm:py-1.5 text-base sm:text-sm text-foreground/80 transition-colors hover:bg-accent active:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


// ── Transport Route Panel ─────────────────────────────────────────

const ROUTE_TYPES = [
  { value: "rail", label: "Rail", color: "#6366f1" },
  { value: "highway", label: "Highway", color: "#f59e0b" },
  { value: "shipping", label: "Shipping Lane", color: "#06b6d4" },
  { value: "air", label: "Air Route", color: "#a855f7" },
] as const;

function TransportPanel({
  countryId,
  onCancel,
}: {
  countryId?: string;
  onCancel: () => void;
}) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["rail", "highway"]);
  const [clearExisting, setClearExisting] = useState(false);
  const [tab, setTab] = useState<"routes" | "generate">("routes");

  const utils = api.useUtils();

  const generateRoutes = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const updateRoute = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
    },
  });

  // Existing routes as GeoJSON (has id, name, routeType, lengthKm, status)
  const { data: routeData } = api.transport.getCountryRoutes.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId },
  );

  const { data: stats } = api.transport.getTransportStats.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId },
  );

  if (!countryId) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Transport Routes
        </h3>
        <p className="text-xs text-muted-foreground">No country selected.</p>
      </div>
    );
  }

  const routes = routeData?.features ?? [];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Transport Network
      </h3>

      {/* Stats summary */}
      {stats && stats.totalRoutes > 0 && (
        <div className="flex gap-3 text-xs">
          <div className="text-center">
            <div className="font-semibold tabular-nums text-foreground">{stats.totalRoutes}</div>
            <div className="text-[10px] text-muted-foreground">Routes</div>
          </div>
          <div className="text-center">
            <div className="font-semibold tabular-nums text-foreground">{stats.totalKm.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">km</div>
          </div>
          <div className="text-center">
            <div className="font-semibold tabular-nums text-foreground">{stats.totalHubs}</div>
            <div className="text-[10px] text-muted-foreground">Hubs</div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
        <button
          onClick={() => setTab("routes")}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            tab === "routes" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Routes ({routes.length})
        </button>
        <button
          onClick={() => setTab("generate")}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            tab === "generate" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Generate
        </button>
      </div>

      {/* Routes tab — list of existing routes with edit/delete */}
      {tab === "routes" && (
        <div className="space-y-1">
          {routes.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No routes yet. Use the Generate tab to create routes.
            </p>
          ) : (
            <div className="max-h-60 space-y-0.5 overflow-y-auto">
              {routes.map((route) => {
                const props = route.properties as Record<string, unknown>;
                const routeType = ROUTE_TYPES.find(r => r.value === props.routeType);
                const status = (props.status as string) ?? "operational";

                return (
                  <div
                    key={props.id as string}
                    className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: routeType?.color ?? "#888" }}
                    />
                    <span className="flex-1 truncate text-foreground">
                      {(props.name as string) ?? `${routeType?.label ?? "Route"}`}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {props.lengthKm ? `${Number(props.lengthKm).toLocaleString()}km` : ""}
                    </span>
                    {/* Status dot */}
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        status === "operational" ? "bg-emerald-500"
                          : status === "planned" ? "bg-slate-400"
                          : status === "under_construction" ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      title={status.replace("_", " ")}
                    />
                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          const newStatus = status === "operational" ? "abandoned"
                            : status === "abandoned" ? "planned"
                            : status === "planned" ? "under_construction"
                            : "operational";
                          updateRoute.mutate({
                            id: props.id as string,
                            countryId,
                            status: newStatus as "planned" | "under_construction" | "operational" | "abandoned",
                          });
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-500/10"
                        title="Cycle status"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete this route?`)) {
                            deleteRoute.mutate({ id: props.id as string, countryId });
                          }
                        }}
                        disabled={deleteRoute.isPending}
                        className="rounded p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/10"
                        title="Delete route"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Generate tab */}
      {tab === "generate" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {ROUTE_TYPES.map((rt) => {
              const isSelected = selectedTypes.includes(rt.value);
              return (
                <button
                  key={rt.value}
                  onClick={() =>
                    setSelectedTypes((prev) =>
                      isSelected ? prev.filter((t) => t !== rt.value) : [...prev, rt.value]
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rt.color }} />
                  {rt.label}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground/80">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            Clear existing routes first
          </label>

          {generateRoutes.isSuccess && generateRoutes.data && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Generated {generateRoutes.data.routesCreated} routes ({generateRoutes.data.totalLengthKm} km)
            </div>
          )}

          {generateRoutes.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {generateRoutes.error.message}
            </div>
          )}

          <button
            onClick={async () => {
              if (!countryId || selectedTypes.length === 0) return;
              try { await generateRoutes.mutateAsync({ countryId, routeTypes: selectedTypes, clearExisting }); } catch { /* shown via state */ }
            }}
            disabled={selectedTypes.length === 0 || generateRoutes.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {generateRoutes.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generateRoutes.isPending ? "Generating..." : "Generate Routes"}
          </button>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-accent"
      >
        Done
      </button>
    </div>
  );
}


// ── Paint Mode Panel ──────────────────────────────────────────────

const PAINT_MODES = [
  { key: "population", label: "Population", icon: Users, color: "text-orange-500" },
  { key: "development", label: "Development", icon: TrendingUp, color: "text-blue-500" },
  { key: "resources", label: "Resources", icon: Gem, color: "text-amber-500" },
  { key: "wiki", label: "Wiki Coverage", icon: BookOpen, color: "text-emerald-500" },
] as const;

function PaintModePanel({
  countryId,
  onCancel,
}: {
  countryId?: string;
  onCancel: () => void;
}) {
  const [activeMode, setActiveMode] = useState<string>("population");

  const { data: stats, isLoading } = api.geo.getSubdivisionStats.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, staleTime: 60_000 },
  );

  // Summary stats
  const totalPop = stats?.reduce((s, r) => s + (r.population ?? 0), 0) ?? 0;
  const totalArea = stats?.reduce((s, r) => s + (r.areaSqKm ?? 0), 0) ?? 0;
  const avgDev = stats && stats.length > 0
    ? (stats.reduce((s, r) => s + r.developmentScore, 0) / stats.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Province Painter
      </h3>

      {/* Map mode selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {PAINT_MODES.map((m) => {
          const Icon = m.icon;
          const isActive = activeMode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setActiveMode(m.key)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className={`h-3 w-3 ${isActive ? "text-primary" : m.color}`} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : stats && stats.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Regions</span>
            <span className="font-medium tabular-nums">{stats.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Population</span>
            <span className="font-medium tabular-nums">{totalPop.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Area</span>
            <span className="font-medium tabular-nums">{Math.round(totalArea).toLocaleString()} km²</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Avg Development</span>
            <span className="font-medium tabular-nums">{avgDev}/10</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No regions to analyze.</p>
      )}

      {/* Per-region ranking */}
      {stats && stats.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {PAINT_MODES.find(m => m.key === activeMode)?.label} Ranking
          </div>
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {[...stats]
              .sort((a, b) => {
                switch (activeMode) {
                  case "population": return (b.population ?? 0) - (a.population ?? 0);
                  case "development": return b.developmentScore - a.developmentScore;
                  case "resources": return b.resourceCount - a.resourceCount;
                  case "wiki": return (b.totalFeatures > 0 ? b.wikiLinked / b.totalFeatures : 0) - (a.totalFeatures > 0 ? a.wikiLinked / a.totalFeatures : 0);
                  default: return 0;
                }
              })
              .map((s, i) => (
                <div key={s.id} className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] hover:bg-accent">
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {activeMode === "population" && (s.population ?? 0).toLocaleString()}
                    {activeMode === "development" && s.developmentScore.toFixed(1)}
                    {activeMode === "resources" && s.resourceCount}
                    {activeMode === "wiki" && `${s.wikiLinked}/${s.totalFeatures}`}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent"
      >
        Done
      </button>
    </div>
  );
}
