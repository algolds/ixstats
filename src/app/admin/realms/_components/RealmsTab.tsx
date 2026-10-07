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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  SystemRestart as Loader2,
  EditPencil as Pencil,
  Check,
  Xmark as X,
  Globe,
  Eye,
  Plus,
} from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";
import { STAFF_FOUNDER_ID } from "~/lib/realms/realm-region";
import { DeleteRealmButton } from "./DeleteRealmButton";
import { TransferRealmButton } from "./TransferRealmButton";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green/10 text-green border-green/20",
  draft: "bg-yellow/10 text-yellow border-yellow/20",
  generating: "bg-blue/10 text-blue border-blue/20",
  archived: "bg-fill-3 text-label-secondary border-separator",
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

/** Decision 15's per-realm cap: a number field while editing, else the realm's current value. */
function NationCapCell({
  editing,
  current,
  draft,
  onChange,
}: {
  editing: boolean;
  current: number;
  draft: string | undefined;
  onChange: (value: string) => void;
}) {
  if (!editing) return <TableCell className="px-4 text-center font-medium">{current}</TableCell>;
  return (
    <TableCell className="px-4">
      <Input
        type="number"
        min={1}
        max={20}
        step={1}
        aria-label="Nations per player"
        className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-20"
        value={draft ?? String(current)}
        onChange={(e) => onChange(e.target.value)}
      />
    </TableCell>
  );
}

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
      className="border-separator bg-surface rounded-card grid gap-4 border p-4 sm:grid-cols-2"
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
      <div className="space-y-2">
        <Label htmlFor="new-realm-name">Name</Label>
        <Input
          id="new-realm-name"
          value={form.name}
          maxLength={100}
          placeholder="Eurth"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-realm-slug">Slug</Label>
        <Input
          id="new-realm-slug"
          className="font-mono"
          value={form.slug}
          maxLength={40}
          placeholder="eurth"
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
        />
        <p className="text-label-secondary text-footnote">
          2–40 lower-case letters, digits or hyphens. Not editable after creation.
        </p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="new-realm-description">Description</Label>
        <Textarea
          id="new-realm-description"
          value={form.description}
          maxLength={1000}
          rows={2}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
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

/**
 * A realm's founder (decision: site admins assign them). Changing it goes through the Transfer action, which
 * asks for the realm's slug and records the handover in the admin audit log.
 */
function FounderCell({ current }: { current: string }) {
  return (
    <TableCell className="text-label-secondary text-footnote px-4">
      {current === STAFF_FOUNDER_ID ? (
        "IxStats staff"
      ) : (
        <span className="font-mono">{current.slice(0, 12)}...</span>
      )}
    </TableCell>
  );
}

export function RealmsTab() {
  const notify = useNotify();
  const { data: realms, isLoading, refetch } = api.realms.adminListRealms.useQuery();
  const updateMutation = api.realms.adminUpdateRealm.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
    },
    onError: (error) => notify.error("Could not update realm", error.message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name?: string;
    status?: string;
    visibility?: string;
    description?: string;
    maxNationsPerUser?: string;
  }>({});

  if (isLoading) {
    return (
      <div className="text-label-secondary flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-body">Loading realms...</span>
      </div>
    );
  }

  if (!realms?.length) {
    return (
      <div className="space-y-4">
        <NewRealmForm />
        <div className="text-label-secondary py-16 text-center">
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
      maxNationsPerUser: String(realm.maxNationsPerUser),
    });
  }

  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      name: editForm.name,
      status: editForm.status as "draft" | "generating" | "active" | "archived",
      visibility: editForm.visibility as "unlisted" | "public",
      description: editForm.description,
      maxNationsPerUser: Number(editForm.maxNationsPerUser),
    });
  }

  return (
    <div className="space-y-4">
      <NewRealmForm />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Slug</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Visibility</TableHead>
              <TableHead className="px-4">Countries</TableHead>
              <TableHead className="px-4">Nations per player</TableHead>
              <TableHead className="px-4">Founder</TableHead>
              <TableHead className="px-4">Updated</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {realms.map((realm) => {
              const isEditing = editingId === realm.id;
              const VisIcon = VISIBILITY_ICONS[realm.visibility] ?? Globe;

              return (
                <TableRow key={realm.id}>
                  <TableCell className="px-4">
                    {isEditing ? (
                      <Input
                        className="w-full"
                        value={editForm.name ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-medium">{realm.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-label-secondary text-footnote px-4 font-mono">
                    {realm.slug}
                  </TableCell>
                  <TableCell className="px-4">
                    {isEditing ? (
                      <Select
                        value={editForm.status}
                        onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="generating">Generating</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`text-caption inline-flex rounded-full border px-2 py-1 ${STATUS_COLORS[realm.status] ?? STATUS_COLORS.draft}`}
                      >
                        {realm.status}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    {isEditing ? (
                      <Select
                        value={editForm.visibility}
                        onValueChange={(v) => setEditForm((f) => ({ ...f, visibility: v }))}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="unlisted">Unlisted</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-label-secondary text-footnote inline-flex items-center gap-1">
                        <VisIcon className="h-3 w-3" />
                        {realm.visibility}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-center font-medium">
                    {realm._count.countries}
                  </TableCell>
                  <NationCapCell
                    editing={isEditing}
                    current={realm.maxNationsPerUser}
                    draft={editForm.maxNationsPerUser}
                    onChange={(v) => setEditForm((f) => ({ ...f, maxNationsPerUser: v }))}
                  />
                  <FounderCell current={realm.ownerId} />
                  <TableCell className="text-label-secondary text-footnote px-4">
                    {new Date(realm.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    {isEditing ? (
                      <span className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Save ${realm.name}`}
                          onClick={() => saveEdit(realm.id)}
                          disabled={updateMutation.isPending}
                          className="text-green"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Check />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancel edit"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${realm.name}`}
                          onClick={() => startEdit(realm)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <TransferRealmButton realm={realm} />
                        <DeleteRealmButton
                          realm={{ ...realm, countryCount: realm._count.countries }}
                        />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
