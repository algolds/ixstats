"use client";

import React from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { SOVEREIGNTY_TYPES } from "~/lib/map-config";

interface SovereigntyPanelProps {
  filteredRelations: any[];
  showSovereigntyForm: boolean;
  setShowSovereigntyForm: (show: boolean) => void;
  resetSovereigntyForm: () => void;
  editingSovereigntyId: string | null;
  sovereigntyForm: {
    sovereignId: string;
    subjectId: string;
    relationshipType: string;
    autonomyLevel: number;
    description: string;
    establishedDate: string;
  };
  setSovereigntyForm: (form: any) => void;
  countries: any[];
  createSovereignty: any;
  updateSovereignty: any;
  handleCreateSovereignty: () => void;
  handleUpdateSovereignty: () => void;
  handleDeleteSovereignty: (id: string) => void;
  handleEditSovereignty: (rel: any) => void;
  sovereigntySearch: string;
  setSovereigntySearch: (s: string) => void;
  sovereigntyTypeFilter: string;
  setSovereigntyTypeFilter: (f: string) => void;
  relationsLoading: boolean;
}

export function SovereigntyPanel({
  filteredRelations,
  showSovereigntyForm,
  setShowSovereigntyForm,
  resetSovereigntyForm,
  editingSovereigntyId,
  sovereigntyForm,
  setSovereigntyForm,
  countries,
  createSovereignty,
  updateSovereignty,
  handleCreateSovereignty,
  handleUpdateSovereignty,
  handleDeleteSovereignty,
  handleEditSovereignty,
  sovereigntySearch,
  setSovereigntySearch,
  sovereigntyTypeFilter,
  setSovereigntyTypeFilter,
  relationsLoading,
}: SovereigntyPanelProps) {
  const typeLabel = (t: string) => SOVEREIGNTY_TYPES.find((s) => s.value === t)?.label ?? t;

  return (
    <div className="space-y-4 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{filteredRelations.length} Relations</span>
        {!showSovereigntyForm && (
          <button
            onClick={() => {
              resetSovereigntyForm();
              setShowSovereigntyForm(true);
            }}
            className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" /> New Relation
          </button>
        )}
      </div>

      {showSovereigntyForm && (
        <div className="bg-muted/40 border-border/50 space-y-2.5 rounded-lg border p-3">
          <h4 className="text-foreground border-border/30 border-b pb-1 text-[10px] font-semibold tracking-wider uppercase">
            {editingSovereigntyId ? "Edit Sovereignty" : "New Sovereignty Relation"}
          </h4>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-muted-foreground mb-0.5 block">Sovereign (Parent)</label>
              <select
                value={sovereigntyForm.sovereignId}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, sovereignId: e.target.value })
                }
                disabled={!!editingSovereigntyId}
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              >
                <option value="">Select parent...</option>
                {countries.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Subject (Dependency)</label>
              <select
                value={sovereigntyForm.subjectId}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, subjectId: e.target.value })
                }
                disabled={!!editingSovereigntyId}
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              >
                <option value="">Select subject...</option>
                {countries
                  .filter((c: any) => c.id !== sovereigntyForm.sovereignId)
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Type</label>
              <select
                value={sovereigntyForm.relationshipType}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, relationshipType: e.target.value })
                }
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              >
                {SOVEREIGNTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">
                Autonomy: {sovereigntyForm.autonomyLevel}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={sovereigntyForm.autonomyLevel}
                onChange={(e) =>
                  setSovereigntyForm({
                    ...sovereigntyForm,
                    autonomyLevel: parseInt(e.target.value),
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Established</label>
              <input
                type="text"
                placeholder="e.g. 1920"
                value={sovereigntyForm.establishedDate}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, establishedDate: e.target.value })
                }
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-0.5 block">Description</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={sovereigntyForm.description}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, description: e.target.value })
                }
                className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div className="border-border/30 flex justify-end gap-1.5 border-t pt-2">
            <button
              onClick={editingSovereigntyId ? handleUpdateSovereignty : handleCreateSovereignty}
              disabled={
                createSovereignty.isPending ||
                updateSovereignty.isPending ||
                !sovereigntyForm.sovereignId ||
                !sovereigntyForm.subjectId
              }
              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={resetSovereigntyForm}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search relations..."
          value={sovereigntySearch}
          onChange={(e) => setSovereigntySearch(e.target.value)}
          className="bg-background border-border w-full rounded border px-2 py-1 text-xs"
        />
        <select
          value={sovereigntyTypeFilter}
          onChange={(e) => setSovereigntyTypeFilter(e.target.value)}
          className="bg-background border-border rounded border px-2 py-1 text-xs"
        >
          <option value="all">All Types</option>
          {SOVEREIGNTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-0.5">
        {relationsLoading ? (
          <p className="text-muted-foreground py-4 text-center italic">Loading relations...</p>
        ) : filteredRelations.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center italic">No relations found.</p>
        ) : (
          filteredRelations.map((rel) => (
            <div
              key={rel.id}
              className="border-border/30 bg-muted/10 hover:border-border/60 flex items-center justify-between rounded-lg border p-2 transition-colors"
            >
              <div className="max-w-[85%] truncate">
                <div className="flex items-center gap-1.5">
                  {rel.sovereignFlag && (
                    <img
                      src={rel.sovereignFlag}
                      alt=""
                      className="border-border/30 h-3 w-4.5 rounded border object-cover"
                    />
                  )}
                  <span className="text-foreground truncate font-semibold">
                    {rel.sovereignName}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-1 pl-6 text-[10px]">
                  <span>➔</span>
                  <span>{rel.subjectName}</span>
                  <span className="ml-1 rounded-sm bg-indigo-500/10 px-1 text-[9px] text-indigo-500">
                    {typeLabel(rel.relationshipType)}
                  </span>
                </div>
              </div>
              <div className="ml-1 flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleEditSovereignty(rel)}
                  className="rounded p-0.5 text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
                >
                  <Edit className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDeleteSovereignty(rel.id)}
                  className="rounded p-0.5 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
