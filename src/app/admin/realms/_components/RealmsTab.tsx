"use client";
// src/app/admin/realms/_components/RealmsTab.tsx
// Realms Management Tab with Facet Glass & Apple Tactile Physics

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  SystemRestart as Loader2,
  EditPencil as Pencil,
  Check,
  Xmark as X,
  Globe,
  Eye,
  Plus,
} from "iconoir-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  draft: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  generating: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-muted/50 text-muted-foreground border-border",
};

const VISIBILITY_ICONS: Record<string, typeof Globe> = {
  public: Globe,
  unlisted: Eye,
};

interface NewRealm {
  slug: string;
  name: string;
  description: string;
  visibility: "public" | "unlisted";
}
const EMPTY_REALM: NewRealm = { slug: "", name: "", description: "", visibility: "unlisted" };

/** "New realm" (ruling E-j): realms are created here by an admin, active, founder "system". */
function NewRealmForm() {
  const utils = api.useUtils();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_REALM);
  const create = api.realms.adminCreateRealm.useMutation({
    onSuccess: (realm) => {
      notify.success("Realm created", `${realm.name} (${realm.slug}) is active.`);
      setForm(EMPTY_REALM);
      setOpen(false);
      void utils.realms.adminListRealms.invalidate();
    },
    onError: (error) => notify.error("Could not create realm", error.message),
  });
  const valid = REALM_SLUG_PATTERN.test(form.slug) && form.name.trim().length > 0;

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New realm
        </Button>
      </div>
    );
  }

  return (
    <form
      className="border-border/40 bg-card/25 grid gap-4 rounded-2xl border p-4 backdrop-blur-md sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          slug: form.slug,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          visibility: form.visibility,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-realm-name">Name</Label>
        <Input
          id="new-realm-name"
          value={form.name}
          maxLength={100}
          placeholder="Eurth"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-realm-slug">Slug</Label>
        <Input
          id="new-realm-slug"
          className="font-mono"
          value={form.slug}
          maxLength={40}
          placeholder="eurth"
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
        />
        <p className="text-muted-foreground text-xs">
          2–40 lower-case letters, digits or hyphens. Not editable after creation.
        </p>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="new-realm-description">Description</Label>
        <Textarea
          id="new-realm-description"
          value={form.description}
          maxLength={1000}
          rows={2}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-realm-visibility">Visibility</Label>
        <Select
          value={form.visibility}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, visibility: v === "public" ? "public" : "unlisted" }))
          }
        >
          <SelectTrigger id="new-realm-visibility" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unlisted" description="Reachable by link, not listed">
              Unlisted
            </SelectItem>
            <SelectItem value="public" description="Listed for everyone">
              Public
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!valid || create.isPending}>
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create realm
        </Button>
      </div>
    </form>
  );
}

export function RealmsTab() {
  const { data: realms, isLoading, refetch } = api.realms.adminListRealms.useQuery();
  const updateMutation = api.realms.adminUpdateRealm.useMutation({
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
      <div className="space-y-4">
        <NewRealmForm />
        <div className="text-muted-foreground py-16 text-center">
          No realms found. The default realm should be seeded automatically.
        </div>
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
      visibility: editForm.visibility as "unlisted" | "public",
      description: editForm.description,
    });
  }

  return (
    <div className="space-y-4">
      <NewRealmForm />
      <div className="border-border/40 bg-card/25 overflow-x-auto rounded-2xl border backdrop-blur-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border/40 bg-muted/20 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Slug</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Visibility</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Countries</th>
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
                <tr
                  key={realm.id}
                  className="border-border/20 hover:bg-muted/20 border-b transition-colors"
                >
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="border-border/40 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-sm focus:outline-none"
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
                        className="border-border/40 bg-background text-foreground rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
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
                        className="border-border/40 bg-background text-foreground rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                        value={editForm.visibility}
                        onChange={(e) => setEditForm((f) => ({ ...f, visibility: e.target.value }))}
                      >
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                      </select>
                    ) : (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <VisIcon className="h-3 w-3" />
                        {realm.visibility}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{realm._count.countries}</td>
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
                          className="rounded-lg p-1 text-emerald-500 transition-transform hover:bg-emerald-500/10 active:scale-[0.98]"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-muted-foreground hover:bg-muted/50 rounded-lg p-1 transition-transform active:scale-[0.98]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit(realm)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
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

export default RealmsTab;
