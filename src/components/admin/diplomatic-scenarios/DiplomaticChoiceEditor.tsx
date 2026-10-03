"use client";

import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { JsonViewer } from "~/components/shared/json-viewer";
import { Plus, EditPencil as Pencil, Trash as Trash2, Check } from "iconoir-react";
import { type ChoiceFormData, RISK_LEVELS } from "~/lib/admin/diplomatic-scenario-transforms";

interface DiplomaticChoiceEditorProps {
  responseOptions: ChoiceFormData[];
  choiceFormData: ChoiceFormData;
  setChoiceFormData: React.Dispatch<React.SetStateAction<ChoiceFormData>>;
  editingChoiceIndex: number | null;
  onAddChoice: () => void;
  onEditChoice: (index: number) => void;
  onSaveChoice: () => void;
  onDeleteChoice: (index: number) => void;
  onCancelChoiceEdit: () => void;
}

export function DiplomaticChoiceEditor({
  responseOptions,
  choiceFormData,
  setChoiceFormData,
  editingChoiceIndex,
  onAddChoice,
  onEditChoice,
  onSaveChoice,
  onDeleteChoice,
  onCancelChoiceEdit,
}: DiplomaticChoiceEditorProps) {
  const [effectsJson, setEffectsJson] = useState(JSON.stringify(choiceFormData.effects, null, 2));
  const [outcomesJson, setOutcomesJson] = useState(
    JSON.stringify(choiceFormData.predictedOutcomes, null, 2)
  );

  return (
    <div className="space-y-4">
      {/* Choices List */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="text-label text-body font-medium">
            Response Choices ({responseOptions.length})
          </label>
          <Button variant="destructive" size="sm" type="button" onClick={onAddChoice}>
            <Plus className="mr-2 h-4 w-4" />
            Add choice
          </Button>
        </div>

        {responseOptions.length === 0 ? (
          <div className="rounded-control border-separator border border-dashed py-8 text-center">
            <p className="text-label-secondary text-body">No choices added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {responseOptions.map((choice, index) => (
              <Card key={choice.id || index} className="flex flex-col gap-6 p-3 py-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-label text-body font-medium">{choice.label}</span>
                      <span
                        className={`rounded-control-sm text-footnote px-2 py-0.5 ${
                          RISK_LEVELS.find((r) => r.value === choice.riskLevel)?.color ||
                          "text-label-secondary"
                        } bg-fill-4`}
                      >
                        {choice.riskLevel}
                      </span>
                    </div>
                    <p className="text-label-secondary text-footnote line-clamp-2">
                      {choice.description}
                    </p>
                    <div className="text-label-secondary text-footnote mt-2 flex items-center gap-3">
                      <span>
                        Skill: {choice.skillRequired} ({choice.skillLevel})
                      </span>
                    </div>

                    {((choice.effects && Object.keys(choice.effects).length > 0) ||
                      (choice.predictedOutcomes &&
                        Object.keys(choice.predictedOutcomes).length > 0)) && (
                      <details className="mt-2">
                        <summary className="text-label-secondary hover:text-label text-subhead mb-1 cursor-pointer select-none">
                          View effects & outcomes
                        </summary>
                        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {choice.effects && Object.keys(choice.effects).length > 0 && (
                            <div>
                              <span className="text-label-secondary text-eyebrow mb-1 block">
                                Effects
                              </span>
                              <JsonViewer
                                data={choice.effects}
                                defaultExpanded={1}
                                className="border-separator bg-surface"
                              />
                            </div>
                          )}
                          {choice.predictedOutcomes &&
                            Object.keys(choice.predictedOutcomes).length > 0 && (
                              <div>
                                <span className="text-label-secondary text-eyebrow mb-1 block">
                                  Predicted outcomes
                                </span>
                                <JsonViewer
                                  data={choice.predictedOutcomes}
                                  defaultExpanded={1}
                                  className="border-separator bg-surface"
                                />
                              </div>
                            )}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="ml-2 flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setEffectsJson(JSON.stringify(choice.effects || {}, null, 2));
                        setOutcomesJson(JSON.stringify(choice.predictedOutcomes || {}, null, 2));
                        onEditChoice(index);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => onDeleteChoice(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Choice Editor Sub-Card */}
      {editingChoiceIndex !== null && (
        <Card className="border-red/30 flex flex-col gap-6 border-2 p-4 py-6">
          <h4 className="text-label text-body mb-3 font-medium">
            {editingChoiceIndex < responseOptions.length ? "Edit Choice" : "Add New Choice"}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-label text-body mb-2 block font-medium">Label *</label>
              <Input
                value={choiceFormData.label}
                onChange={(e) => setChoiceFormData((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., Diplomatic Negotiation"
              />
            </div>

            <div>
              <label className="text-label text-body mb-2 block font-medium">Description *</label>
              <Textarea
                value={choiceFormData.description}
                onChange={(e) =>
                  setChoiceFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Detailed description of this choice and its approach..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-label text-body mb-2 block font-medium">
                  Skill required
                </label>
                <Input
                  value={choiceFormData.skillRequired}
                  onChange={(e) =>
                    setChoiceFormData((prev) => ({ ...prev, skillRequired: e.target.value }))
                  }
                  placeholder="diplomacy"
                />
              </div>
              <div>
                <label className="text-label text-body mb-2 block font-medium">Skill level</label>
                <Input
                  type="number"
                  value={choiceFormData.skillLevel}
                  onChange={(e) =>
                    setChoiceFormData((prev) => ({
                      ...prev,
                      skillLevel: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="text-label text-body mb-2 block font-medium">Risk level</label>
                <Select
                  value={choiceFormData.riskLevel}
                  onValueChange={(value) =>
                    setChoiceFormData((prev) => ({ ...prev, riskLevel: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-label text-body mb-2 block font-medium">Effects (JSON)</label>
              <Textarea
                value={effectsJson}
                onChange={(e) => {
                  setEffectsJson(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setChoiceFormData((prev) => ({ ...prev, effects: parsed }));
                  } catch {
                    // Invalid JSON, wait for valid input
                  }
                }}
                placeholder='{"relationshipChange": 10, "culturalImpact": 5}'
                rows={3}
                className="md:text-footnote font-mono"
              />
            </div>

            <div>
              <label className="text-label text-body mb-2 block font-medium">
                Predicted Outcomes (JSON)
              </label>
              <Textarea
                value={outcomesJson}
                onChange={(e) => {
                  setOutcomesJson(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setChoiceFormData((prev) => ({ ...prev, predictedOutcomes: parsed }));
                  } catch {
                    // Invalid JSON, wait for valid input
                  }
                }}
                placeholder='{"shortTerm": "Improved relations", "longTerm": "Trade agreement signed"}'
                rows={3}
                className="md:text-footnote font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="destructive" size="sm" type="button" onClick={onSaveChoice}>
                <Check className="mr-2 h-4 w-4" />
                Save choice
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={onCancelChoiceEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
