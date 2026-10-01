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
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Slider } from "~/components/ui/slider";

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
    <div className="text-footnote space-y-4 p-3">
      <div className="flex items-center justify-between">
        <span className="text-label-secondary text-footnote">
          {filteredRelations.length} Relations
        </span>
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
        <FacetCard className="space-y-2 p-3">
          <Eyebrow className="border-separator block border-b pb-1">
            {editingSovereigntyId ? "Edit Sovereignty" : "New Sovereignty Relation"}
          </Eyebrow>
          <div className="text-footnote space-y-2">
            <div>
              <label className="text-label-secondary mb-0.5 block">Sovereign (Parent)</label>
              <OptionSelect
                aria-label="Sovereign (parent)"
                disabled={!!editingSovereigntyId}
                value={sovereigntyForm.sovereignId}
                onValueChange={(v) => setSovereigntyForm({ ...sovereigntyForm, sovereignId: v })}
                options={[
                  { value: "", label: "Select parent..." },
                  ...countries.map((c) => ({ value: c.id, label: c.name })),
                ]}
                size="sm"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-label-secondary mb-0.5 block">Subject (Dependency)</label>
              <OptionSelect
                aria-label="Subject country"
                size="sm"
                value={sovereigntyForm.subjectId}
                onValueChange={(v) => setSovereigntyForm({ ...sovereigntyForm, subjectId: v })}
                disabled={!!editingSovereigntyId}
                options={[
                  { value: "", label: "Select subject..." },
                  ...countries
                    .filter((c: PropertiesPanelCountry) => c.id !== sovereigntyForm.sovereignId)
                    .map((c: PropertiesPanelCountry) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-label-secondary mb-0.5 block">Type</label>
              <OptionSelect
                aria-label="Type"
                value={sovereigntyForm.relationshipType}
                onValueChange={(v) =>
                  setSovereigntyForm({ ...sovereigntyForm, relationshipType: v })
                }
                options={SOVEREIGNTY_TYPES}
                size="sm"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-label-secondary mb-0.5 block">
                Autonomy: {sovereigntyForm.autonomyLevel}%
              </label>
              <Slider
                aria-label="Autonomy"
                min={0}
                max={100}
                value={[sovereigntyForm.autonomyLevel]}
                onValueChange={([v]) =>
                  v !== undefined &&
                  setSovereigntyForm({
                    ...sovereigntyForm,
                    autonomyLevel: v,
                  })
                }
                className="w-full py-2"
              />
            </div>
            <div>
              <label className="text-label-secondary mb-0.5 block">Established</label>
              <input
                type="text"
                placeholder="e.g. 1920"
                value={sovereigntyForm.establishedDate}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, establishedDate: e.target.value })
                }
                className="border-separator bg-surface focus:ring-tint text-footnote rounded-control-sm w-full border px-2 py-1 focus:ring-1 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-label-secondary mb-0.5 block">Description</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={sovereigntyForm.description}
                onChange={(e) =>
                  setSovereigntyForm({ ...sovereigntyForm, description: e.target.value })
                }
                className="border-separator bg-surface focus:ring-tint text-footnote rounded-control-sm w-full border px-2 py-1 focus:ring-1 focus:outline-none"
              />
            </div>
          </div>
          <div className="border-separator flex justify-end gap-2 border-t pt-2">
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
              className="text-label-secondary"
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
          className="bg-surface border-separator focus:ring-tint text-footnote rounded-control-sm w-full border px-2 py-1 focus:ring-1 focus:outline-none"
        />
        <OptionSelect
          aria-label="Sovereignty type"
          value={sovereigntyTypeFilter}
          onValueChange={(v) => setSovereigntyTypeFilter(v)}
          options={[{ value: "all", label: "All Types" }, ...SOVEREIGNTY_TYPES]}
          size="sm"
          className="w-full"
        />
      </div>

      <div className="max-h-[200px] space-y-2 overflow-y-auto pr-0.5">
        {relationsLoading ? (
          <p className="text-label-secondary py-4 text-center italic">Loading relations...</p>
        ) : filteredRelations.length === 0 ? (
          <p className="text-label-secondary py-4 text-center italic">No relations found.</p>
        ) : (
          filteredRelations.map((rel) => (
            <div
              key={rel.id}
              className="border-separator bg-fill-4 hover:border-separator rounded-control flex items-center justify-between border p-2 transition-colors"
            >
              <div className="max-w-[85%] truncate">
                <div className="flex items-center gap-2">
                  {rel.sovereignFlag && (
                    <img
                      src={rel.sovereignFlag}
                      alt=""
                      className="border-separator h-3 w-4.5 rounded-xs border object-cover"
                    />
                  )}
                  <span className="text-label truncate font-semibold">{rel.sovereignName}</span>
                </div>
                <div className="text-label-secondary text-footnote mt-0.5 flex items-center gap-1 pl-6">
                  <ArrowRight className="h-3 w-3" aria-hidden />
                  <span>{rel.subjectName}</span>
                  <span className="bg-tint-fill text-tint rounded-control-sm text-footnote ml-1 px-1">
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
