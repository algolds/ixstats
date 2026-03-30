"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Loader2, Pencil, Check, X } from "lucide-react";

export function WorldConfigsTab() {
  const { data: configs, isLoading, refetch } = api.studio.adminListWorldConfigs.useQuery();
  const updateMutation = api.studio.adminUpdateWorldConfig.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); },
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
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading world configs...</span>
      </div>
    );
  }

  if (!configs?.length) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        No world configs found.
      </div>
    );
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
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">World ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Realm</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Projection</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Climate</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Wiki</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zoom</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sync</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => {
              const isEditing = editingId === config.id;

              return (
                <tr key={config.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{config.worldId}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
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
                      <span className="text-xs text-muted-foreground/50">Unlinked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                        value={editForm.mapProjection}
                        onChange={(e) => setEditForm((f) => ({ ...f, mapProjection: e.target.value }))}
                      >
                        <option value="globe">Globe</option>
                        <option value="mercator">Mercator</option>
                        <option value="dynamic">Dynamic</option>
                      </select>
                    ) : (
                      <span className="rounded bg-muted/50 px-2 py-0.5 text-xs">{config.mapProjection}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                        value={editForm.climateSystem ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, climateSystem: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs">{config.climateSystem}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {isEditing ? (
                      <input
                        className="w-36 rounded border border-border bg-background px-2 py-1 text-xs"
                        value={editForm.wikiBaseUrl ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, wikiBaseUrl: e.target.value || null }))}
                        placeholder="https://..."
                      />
                    ) : (
                      config.wikiBaseUrl ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                        value={editForm.defaultZoom ?? 2}
                        onChange={(e) => setEditForm((f) => ({ ...f, defaultZoom: parseFloat(e.target.value) }))}
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
                      <div className={`h-2 w-2 rounded-full ${config.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={editForm.syncEnabled ?? true}
                          onChange={(e) => setEditForm((f) => ({ ...f, syncEnabled: e.target.checked }))}
                          className="h-3 w-3 rounded"
                        />
                        <input
                          type="number"
                          className="w-14 rounded border border-border bg-background px-1 py-0.5 text-xs"
                          value={editForm.syncIntervalMin ?? 60}
                          onChange={(e) => setEditForm((f) => ({ ...f, syncIntervalMin: parseInt(e.target.value) }))}
                        />
                        <span className="text-[10px]">min</span>
                      </div>
                    ) : (
                      config.syncEnabled ? `${config.syncIntervalMin}m` : "off"
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
                          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="rounded p-1 text-muted-foreground hover:bg-muted/50">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => startEdit(config)} className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground">
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
