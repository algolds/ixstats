// src/app/admin/realms/_components/WorldConfigsTab.tsx
// World Configuration Editor Tab with Facet Glass & Apple Tactile Physics
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { SystemRestart as Loader2, EditPencil as Pencil, Check, Xmark as X } from "iconoir-react";

export function WorldConfigsTab() {
  const { data: configs, isLoading, refetch } = api.studio.adminListWorldConfigs.useQuery();
  const updateMutation = api.studio.adminUpdateWorldConfig.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name?: string;
    mapProjection?: string;
    climateSystem?: string;
    wikiBaseUrl?: string | null;
    defaultZoom?: number;
    isActive?: boolean;
    syncEnabled?: boolean;
    syncIntervalMin?: number;
  }>({});

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading world configs...</span>
      </div>
    );
  }

  if (!configs?.length) {
    return <div className="text-muted-foreground py-16 text-center">No world configs found.</div>;
  }

  function startEdit(config: NonNullable<typeof configs>[number]) {
    setEditingId(config.id);
    setEditForm({
      name: config.name,
      mapProjection: config.mapProjection,
      climateSystem: config.climateSystem,
      wikiBaseUrl: config.wikiBaseUrl,
      defaultZoom: config.defaultZoom,
      isActive: config.isActive,
      syncEnabled: config.syncEnabled,
      syncIntervalMin: config.syncIntervalMin,
    });
  }

  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      name: editForm.name,
      mapProjection: editForm.mapProjection as "globe" | "mercator" | "dynamic",
      climateSystem: editForm.climateSystem,
      wikiBaseUrl: editForm.wikiBaseUrl,
      defaultZoom: editForm.defaultZoom,
      isActive: editForm.isActive,
      syncEnabled: editForm.syncEnabled,
      syncIntervalMin: editForm.syncIntervalMin,
    });
  }

  return (
    <div className="space-y-4">
      <div className="border-border/40 bg-card/25 overflow-x-auto rounded-2xl border backdrop-blur-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border/40 bg-muted/20 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">World ID</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Realm</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Projection</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Climate</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Wiki</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Zoom</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Active</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Sync</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => {
              const isEditing = editingId === config.id;

              return (
                <tr key={config.id} className="border-border/20 hover:bg-muted/20 border-b transition-colors">
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {config.worldId}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border/40 bg-background text-foreground w-full rounded-lg border px-2 py-1 text-xs focus:outline-none"
                        value={editForm.name ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-medium text-foreground">{config.name}</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {config.realm?.slug ?? config.realmId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="border-border/40 bg-background text-foreground rounded-lg border px-2 py-1 text-xs focus:outline-none"
                        value={editForm.mapProjection ?? "globe"}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, mapProjection: e.target.value }))
                        }
                      >
                        <option value="globe">globe</option>
                        <option value="mercator">mercator</option>
                        <option value="dynamic">dynamic</option>
                      </select>
                    ) : (
                      <span className="font-mono text-xs">{config.mapProjection}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border/40 bg-background text-foreground w-24 rounded-lg border px-2 py-1 text-xs focus:outline-none"
                        value={editForm.climateSystem ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, climateSystem: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="text-xs">{config.climateSystem}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border/40 bg-background text-foreground w-40 rounded-lg border px-2 py-1 text-xs focus:outline-none"
                        value={editForm.wikiBaseUrl ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, wikiBaseUrl: e.target.value || null }))
                        }
                        placeholder="https://..."
                      />
                    ) : config.wikiBaseUrl ? (
                      <span className="font-mono text-xs truncate max-w-[120px] block">
                        {config.wikiBaseUrl}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        className="border-border/40 bg-background text-foreground w-16 rounded-lg border px-2 py-1 text-xs font-mono focus:outline-none"
                        value={editForm.defaultZoom ?? 2}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            defaultZoom: parseFloat(e.target.value),
                          }))
                        }
                      />
                    ) : (
                      <span className="font-mono text-xs">{config.defaultZoom}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editForm.isActive ?? true}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, isActive: e.target.checked }))
                        }
                        className="h-4 w-4 rounded cursor-pointer accent-primary"
                      />
                    ) : (
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          config.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                      />
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={editForm.syncEnabled ?? false}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, syncEnabled: e.target.checked }))
                          }
                          className="h-3.5 w-3.5 rounded cursor-pointer accent-primary"
                        />
                        <input
                          type="number"
                          className="border-border/40 bg-background text-foreground w-14 rounded-lg border px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                          value={editForm.syncIntervalMin ?? 60}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              syncIntervalMin: parseInt(e.target.value),
                            }))
                          }
                        />
                        <span className="text-[10px]">min</span>
                      </div>
                    ) : config.syncEnabled ? (
                      <span className="font-mono">{config.syncIntervalMin}m</span>
                    ) : (
                      <span className="text-muted-foreground/60">off</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <span className="inline-flex gap-1">
                        <button
                          onClick={() => saveEdit(config.id)}
                          disabled={updateMutation.isPending}
                          className="rounded-lg p-1 text-emerald-500 hover:bg-emerald-500/10 active:scale-[0.98] transition-transform"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-muted-foreground hover:bg-muted/50 rounded-lg p-1 active:scale-[0.98] transition-transform"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit(config)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 active:scale-[0.98] transition-transform"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WorldConfigsTab;
