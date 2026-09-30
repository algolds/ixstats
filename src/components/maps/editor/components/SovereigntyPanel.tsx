"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React from "react";
import { Plus, EditPencil as Edit, Trash as Trash2, ArrowRight } from "iconoir-react";
import { SOVEREIGNTY_TYPES } from "~/lib/maps/map-config";
import type {
  SovereigntyRelation,
  SovereigntyFormData,
  PropertiesPanelCountry,
} from "../types/editor-state";

interface SovereigntyPanelProps {
  filteredRelations: SovereigntyRelation[];
  showSovereigntyForm: boolean;
  setShowSovereigntyForm: (show: boolean) => void;
  resetSovereigntyForm: () => void;
  editingSovereigntyId: string | null;
  sovereigntyForm: SovereigntyFormData;
  setSovereigntyForm:
    | React.Dispatch<React.SetStateAction<SovereigntyFormData>>
    | ((form: SovereigntyFormData) => void);
  countries: PropertiesPanelCountry[];
  createSovereignty: { isPending: boolean };
  updateSovereignty: { isPending: boolean };
  handleCreateSovereignty: () => void;
  handleUpdateSovereignty: () => void;
  handleDeleteSovereignty: (id: string) => void;
  handleEditSovereignty: (rel: SovereigntyRelation) => void;
  sovereigntySearch: string;
  setSovereigntySearch: (s: string) => void;
  sovereigntyTypeFilter: string;
  setSovereigntyTypeFilter: (f: string) => void;
  relationsLoading: boolean;
}

export const SovereigntyPanel = React.memo(function SovereigntyPanel({
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
          <Button
            size="xs"
            onClick={() => {
              resetSovereigntyForm();
              setShowSovereigntyForm(true);
            }}
          >
            <Plus className="h-3 w-3" /> New Relation
          </Button>
        )}
      </div>

      {showSovereigntyForm && (
        <FacetCard surface="solid" className="space-y-2.5 rounded-lg p-3">
          <Eyebrow className="border-border/30 block border-b pb-1">
            {editingSovereigntyId ? "Edit Sovereignty" : "New Sovereignty Relation"}
          </Eyebrow>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-muted-foreground mb-0.5 block">Sovereign (Parent)</label>
              <select
                value={sovereigntyForm.sovereignId}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, sovereignId: e.target.value })
                }
                disabled={!!editingSovereigntyId}
                className="border-border bg-background focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
              >
                <option value="">Select parent...</option>
                {countries.map((c: PropertiesPanelCountry) => (
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
                className="border-border bg-background focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
              >
                <option value="">Select subject...</option>
                {countries
                  .filter((c: PropertiesPanelCountry) => c.id !== sovereigntyForm.sovereignId)
                  .map((c: PropertiesPanelCountry) => (
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
                className="border-border bg-background focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
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
                className="accent-primary w-full"
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
                className="border-border bg-background focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
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
                className="border-border bg-background focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
              />
            </div>
          </div>
          <div className="border-border/30 flex justify-end gap-1.5 border-t pt-2">
            <Button
              size="xs"
              onClick={editingSovereigntyId ? handleUpdateSovereignty : handleCreateSovereignty}
              disabled={
                createSovereignty.isPending ||
                updateSovereignty.isPending ||
                !sovereigntyForm.sovereignId ||
                !sovereigntyForm.subjectId
              }
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={resetSovereigntyForm}
            >
              Cancel
            </Button>
          </div>
        </FacetCard>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search relations..."
          value={sovereigntySearch}
          onChange={(e) => setSovereigntySearch(e.target.value)}
          className="bg-background border-border focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
        />
        <select
          value={sovereigntyTypeFilter}
          onChange={(e) => setSovereigntyTypeFilter(e.target.value)}
          className="bg-background border-border focus:ring-primary rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
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
                <div className="text-muted-foreground mt-0.5 flex items-center gap-1 pl-6 text-xs">
                  <ArrowRight className="h-3 w-3" aria-hidden />
                  <span>{rel.subjectName}</span>
                  <span className="bg-primary/10 text-primary ml-1 rounded-sm px-1 text-xs">
                    {typeLabel(rel.relationshipType)}
                  </span>
                </div>
              </div>
              <div className="ml-1 flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleEditSovereignty(rel)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6"
                  onClick={() => handleDeleteSovereignty(rel.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
