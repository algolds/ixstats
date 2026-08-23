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
      <div className="border-border/50 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border/50 bg-muted/30 border-b">
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
                <tr key={config.id} className="border-border/30 hover:bg-muted/20 border-b">
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {config.worldId}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border bg-background w-full rounded border px-2 py-1 text-sm"
                        value={editForm.name ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-medium">{config.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {config.realm ? (
                      <span className="text-xs text-violet-500">{config.realm.name}</span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">Unlinked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="border-border bg-background rounded border px-2 py-1 text-xs"
                        value={editForm.mapProjection}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, mapProjection: e.target.value }))
                        }
                      >
                        <option value="globe">Globe</option>
                        <option value="mercator">Mercator</option>
                        <option value="dynamic">Dynamic</option>
                      </select>
                    ) : (
                      <span className="bg-muted/50 rounded px-2 py-0.5 text-xs">
                        {config.mapProjection}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border bg-background w-24 rounded border px-2 py-1 text-xs"
                        value={editForm.climateSystem ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, climateSystem: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="text-xs">{config.climateSystem}</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {isEditing ? (
                      <input
                        className="border-border bg-background w-36 rounded border px-2 py-1 text-xs"
                        value={editForm.wikiBaseUrl ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, wikiBaseUrl: e.target.value || null }))
                        }
                        placeholder="https://..."
                      />
                    ) : (
                      (config.wikiBaseUrl ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {isEditing ? (
                      <input
                        type="number"
                        className="border-border bg-background w-16 rounded border px-2 py-1 text-xs"
                        value={editForm.defaultZoom ?? 2}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, defaultZoom: parseFloat(e.target.value) }))
                        }
                        step={0.1}
                      />
                    ) : (
                      config.defaultZoom
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editForm.isActive ?? true}
                        onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                        className="h-4 w-4 rounded"
                      />
                    ) : (
                      <div
                        className={`h-2 w-2 rounded-full ${config.isActive ? "bg-green-500" : "bg-gray-400"}`}
                      />
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={editForm.syncEnabled ?? true}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, syncEnabled: e.target.checked }))
                          }
                          className="h-3 w-3 rounded"
                        />
                        <input
                          type="number"
                          className="border-border bg-background w-14 rounded border px-1 py-0.5 text-xs"
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
                      `${config.syncIntervalMin}m`
                    ) : (
                      "off"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <span className="inline-flex gap-1">
                        <button
                          onClick={() => saveEdit(config.id)}
                          disabled={updateMutation.isPending}
                          className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-muted-foreground hover:bg-muted/50 rounded p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit(config)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded p-1"
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
