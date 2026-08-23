"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { SystemRestart as Loader2, EditPencil as Pencil, Check, Xmark as X, Globe, Lock, Eye } from "iconoir-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  draft: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  generating: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const VISIBILITY_ICONS: Record<string, typeof Globe> = {
  public: Globe,
  unlisted: Eye,
  private: Lock,
};

export function RealmsTab() {
  const { data: realms, isLoading, refetch } = api.studio.adminListRealms.useQuery();
  const updateMutation = api.studio.adminUpdateRealm.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name?: string;
    status?: string;
    visibility?: string;
    description?: string;
  }>({});

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading realms...</span>
      </div>
    );
  }

  if (!realms?.length) {
    return (
      <div className="text-muted-foreground py-16 text-center">
        No realms found. The default realm should be seeded automatically.
      </div>
    );
  }

  function startEdit(realm: NonNullable<typeof realms>[number]) {
    setEditingId(realm.id);
    setEditForm({
      name: realm.name,
      status: realm.status,
      visibility: realm.visibility,
      description: realm.description ?? "",
    });
  }

  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      name: editForm.name,
      status: editForm.status as "draft" | "generating" | "active" | "archived",
      visibility: editForm.visibility as "private" | "unlisted" | "public",
      description: editForm.description,
    });
  }

  return (
    <div className="space-y-4">
      <div className="border-border/50 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border/50 bg-muted/30 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Slug</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Visibility</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Countries</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                World Config
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Owner</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Updated</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {realms.map((realm) => {
              const isEditing = editingId === realm.id;
              const VisIcon = VISIBILITY_ICONS[realm.visibility] ?? Globe;

              return (
                <tr key={realm.id} className="border-border/30 hover:bg-muted/20 border-b">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border bg-background w-full rounded border px-2 py-1 text-sm"
                        value={editForm.name ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-medium">{realm.name}</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {realm.slug}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="border-border bg-background rounded border px-2 py-1 text-xs"
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option value="draft">Draft</option>
                        <option value="generating">Generating</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[realm.status] ?? STATUS_COLORS.draft}`}
                      >
                        {realm.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        className="border-border bg-background rounded border px-2 py-1 text-xs"
                        value={editForm.visibility}
                        onChange={(e) => setEditForm((f) => ({ ...f, visibility: e.target.value }))}
                      >
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                    ) : (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <VisIcon className="h-3 w-3" />
                        {realm.visibility}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{realm._count.countries}</td>
                  <td className="px-4 py-3">
                    {realm.worldConfig ? (
                      <span className="text-xs text-emerald-500">{realm.worldConfig.name}</span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">None</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {realm.ownerId === "system" ? "system" : realm.ownerId.slice(0, 12) + "..."}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {new Date(realm.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <span className="inline-flex gap-1">
                        <button
                          onClick={() => saveEdit(realm.id)}
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
                        onClick={() => startEdit(realm)}
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
