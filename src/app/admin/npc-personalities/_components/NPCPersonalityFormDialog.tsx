"use client";
// src/app/admin/npc-personalities/_components/NPCPersonalityFormDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";

export const ARCHETYPES = [
  { value: "aggressive_expansionist", label: "Aggressive Expansionist" },
  { value: "peaceful_merchant", label: "Peaceful Merchant" },
  { value: "cautious_isolationist", label: "Cautious Isolationist" },
  { value: "cultural_diplomat", label: "Cultural Diplomat" },
  { value: "pragmatic_realist", label: "Pragmatic Realist" },
  { value: "ideological_hardliner", label: "Ideological Hardliner" },
] as const;

export interface PersonalityFormData {
  name: string;
  archetype: string;
  historicalBasis?: string;
  historicalContext?: string;
  isActive: boolean;
  traits: {
    assertiveness: number;
    cooperativeness: number;
    militarism: number;
    culturalOpenness: number;
    economicFocus: number;
    diplomaticTendency: number;
    riskTolerance: number;
    ideologicalRigidity: number;
  };
}

interface NPCPersonalityFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: PersonalityFormData;
  setFormData: React.Dispatch<React.SetStateAction<PersonalityFormData>>;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

export function NPCPersonalityFormDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  onClose,
  onSave,
  isPending,
}: NPCPersonalityFormDialogProps) {
  const updateTrait = (trait: keyof PersonalityFormData["traits"], value: number) => {
    setFormData((prev) => ({
      ...prev,
      traits: { ...prev.traits, [trait]: value },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit NPC Personality" : "Create NPC Personality"}</DialogTitle>
          <DialogDescription>
            Configure the baseline archetype and psychological traits driving AI diplomatic
            responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label text-caption mb-2 block">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Strategic Realist"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div>
              <label className="text-label text-caption mb-2 block">Archetype *</label>
              <Select
                value={formData.archetype}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, archetype: val }))}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARCHETYPES.map((arch) => (
                    <SelectItem key={arch.value} value={arch.value}>
                      {arch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label text-caption mb-2 block">Historical Basis</label>
              <Input
                value={formData.historicalBasis || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, historicalBasis: e.target.value }))
                }
                placeholder="e.g., Caphirian Realpolitik"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="is-active-check"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: !!checked }))
                }
              />
              <label htmlFor="is-active-check" className="text-label text-footnote cursor-pointer">
                Active in AI Simulation
              </label>
            </div>
          </div>

          <div>
            <label className="text-label text-caption mb-2 block">Historical Context</label>
            <Textarea
              value={formData.historicalContext || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, historicalContext: e.target.value }))
              }
              placeholder="Background context and foreign policy rationale..."
              rows={2}
              className="md:text-footnote"
            />
          </div>

          {/* Trait Sliders */}
          <div className="border-separator space-y-3 border-t pt-4">
            <h4 className="text-label text-caption">Psychological & Strategic Traits</h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: "assertiveness", label: "Assertiveness" },
                { key: "cooperativeness", label: "Cooperativeness" },
                { key: "militarism", label: "Militarism" },
                { key: "culturalOpenness", label: "Cultural Openness" },
                { key: "economicFocus", label: "Economic Focus" },
                { key: "diplomaticTendency", label: "Diplomatic Tendency" },
                { key: "riskTolerance", label: "Risk Tolerance" },
                { key: "ideologicalRigidity", label: "Ideological Rigidity" },
              ].map(({ key, label }) => {
                const val = formData.traits[key as keyof PersonalityFormData["traits"]];
                return (
                  <div
                    key={key}
                    className="bg-surface border-separator rounded-row space-y-1 border p-3"
                  >
                    <div className="text-footnote flex items-center justify-between">
                      <span className="text-label font-medium">{label}</span>
                      <span className="text-label-secondary tabular-nums">{val}%</span>
                    </div>
                    <Slider
                      value={[val]}
                      onValueChange={([newVal]) =>
                        updateTrait(key as keyof PersonalityFormData["traits"], newVal || 50)
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!formData.name.trim() || isPending}>
            {isPending ? "Saving..." : isEditing ? "Update Personality" : "Create Personality"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
