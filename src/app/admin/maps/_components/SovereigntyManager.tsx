"use client";

/**
 * SovereigntyManager - Admin CRUD for country sovereignty/dependency relationships.
 *
 * Manages crown possessions, vassals, protectorates, and other hierarchical links.
 * Follows the CountryAssigner pattern: filter bar + table + create dialog.
 */

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { SOVEREIGNTY_TYPES } from "~/lib/map-config";

interface FormState {
  sovereignId: string;
  subjectId: string;
  relationshipType: string;
  autonomyLevel: number;
  description: string;
  establishedDate: string;
}

const EMPTY_FORM: FormState = {
  sovereignId: "",
  subjectId: "",
  relationshipType: "crown_possession",
  autonomyLevel: 50,
  description: "",
  establishedDate: "",
};

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:border-blue-500 focus:outline-none";

export function SovereigntyManager() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const utils = api.useUtils();

  const { data: relations, isLoading } =
    api.geo.getSovereigntyRelations.useQuery();

  const { data: dbCountries } = api.countries.getAll.useQuery(
    { limit: 500 },
    { staleTime: 60000 },
  );

  const createMutation = api.geo.createSovereignty.useMutation({
    onSuccess: () => {
      utils.geo.getSovereigntyRelations.invalidate();
      utils.geo.getWorldMap.invalidate();
      utils.geo.getMapStats.invalidate();
      resetForm();
    },
  });

  const updateMutation = api.geo.updateSovereignty.useMutation({
    onSuccess: () => {
      utils.geo.getSovereigntyRelations.invalidate();
      utils.geo.getWorldMap.invalidate();
      resetForm();
    },
  });

  const deleteMutation = api.geo.deleteSovereignty.useMutation({
    onSuccess: () => {
      utils.geo.getSovereigntyRelations.invalidate();
      utils.geo.getWorldMap.invalidate();
      utils.geo.getMapStats.invalidate();
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleCreate = () => {
    if (!form.sovereignId || !form.subjectId) return;
    createMutation.mutate({
      sovereignId: form.sovereignId,
      subjectId: form.subjectId,
      relationshipType: form.relationshipType,
      autonomyLevel: form.autonomyLevel / 100,
      description: form.description || undefined,
      establishedDate: form.establishedDate || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      relationshipType: form.relationshipType,
      autonomyLevel: form.autonomyLevel / 100,
      description: form.description || undefined,
      establishedDate: form.establishedDate || undefined,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this sovereignty relationship?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (rel: NonNullable<typeof relations>[number]) => {
    setEditingId(rel.id);
    setForm({
      sovereignId: rel.sovereignId,
      subjectId: rel.subjectId,
      relationshipType: rel.relationshipType,
      autonomyLevel: Math.round(rel.autonomyLevel * 100),
      description: rel.description ?? "",
      establishedDate: rel.establishedDate ?? "",
    });
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    if (!relations) return [];
    return relations.filter((r) => {
      if (typeFilter !== "all" && r.relationshipType !== typeFilter)
        return false;
      if (
        search &&
        !r.sovereignName.toLowerCase().includes(search.toLowerCase()) &&
        !r.subjectName.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [relations, typeFilter, search]);

  const typeLabel = (t: string) =>
    SOVEREIGNTY_TYPES.find((s) => s.value === t)?.label ?? t;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters + Create */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClasses}
          style={{ width: "auto" }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All Types</option>
          {SOVEREIGNTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} relationship{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        >
          + Create Relationship
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            {editingId ? "Edit Relationship" : "New Sovereignty Relationship"}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Sovereign */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Sovereign (Parent)
              </label>
              <select
                value={form.sovereignId}
                onChange={(e) =>
                  setForm({ ...form, sovereignId: e.target.value })
                }
                disabled={!!editingId}
                className={inputClasses}
              >
                <option value="">Select sovereign...</option>
                {dbCountries?.countries?.map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Subject (Dependency)
              </label>
              <select
                value={form.subjectId}
                onChange={(e) =>
                  setForm({ ...form, subjectId: e.target.value })
                }
                disabled={!!editingId}
                className={inputClasses}
              >
                <option value="">Select subject...</option>
                {dbCountries?.countries
                  ?.filter(
                    (c: { id: string }) => c.id !== form.sovereignId
                  )
                  .map((c: { id: string; name: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Relationship Type
              </label>
              <select
                value={form.relationshipType}
                onChange={(e) =>
                  setForm({ ...form, relationshipType: e.target.value })
                }
                className={inputClasses}
              >
                {SOVEREIGNTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Autonomy */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Autonomy Level: {form.autonomyLevel}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.autonomyLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    autonomyLevel: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Full control</span>
                <span>Autonomous</span>
              </div>
            </div>

            {/* Established Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Established Date
              </label>
              <input
                type="text"
                placeholder="e.g. 1832, IxYear 45"
                value={form.establishedDate}
                onChange={(e) =>
                  setForm({ ...form, establishedDate: e.target.value })
                }
                className={inputClasses}
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Description
              </label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputClasses}
              />
            </div>
          </div>

          {/* Error display */}
          {(createMutation.error || updateMutation.error) && (
            <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {createMutation.error?.message || updateMutation.error?.message}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                (!editingId && (!form.sovereignId || !form.subjectId))
              }
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingId
                  ? "Update"
                  : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="px-4 py-3 text-left font-medium text-foreground/80">
                Sovereign
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground/80">
                Subject
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground/80">
                Type
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground/80">
                Autonomy
              </th>
              <th className="px-4 py-3 text-left font-medium text-foreground/80">
                Est.
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground/80">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {relations?.length === 0
                    ? "No sovereignty relationships yet. Create one above."
                    : "No results match your filter."}
                </td>
              </tr>
            ) : (
              filtered.map((rel) => (
                <tr
                  key={rel.id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {rel.sovereignFlag && (
                        <img
                          src={rel.sovereignFlag}
                          alt=""
                          className="h-4 w-6 rounded-sm border border-border object-cover"
                        />
                      )}
                      <span className="font-medium text-foreground">
                        {rel.sovereignName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {rel.subjectFlag && (
                        <img
                          src={rel.subjectFlag}
                          alt=""
                          className="h-4 w-6 rounded-sm border border-border object-cover"
                        />
                      )}
                      <span className="text-foreground">
                        {rel.subjectName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {typeLabel(rel.relationshipType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{
                            width: `${Math.round(rel.autonomyLevel * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(rel.autonomyLevel * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {rel.establishedDate || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleEdit(rel)}
                        className="rounded px-2 py-1 text-xs text-blue-500 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rel.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
