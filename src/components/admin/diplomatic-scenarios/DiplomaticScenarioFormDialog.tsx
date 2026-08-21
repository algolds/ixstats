"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
import {
  Settings,
  FileText,
  List,
  Target,
} from "lucide-react";
import {
  type ScenarioFormData,
  type ChoiceFormData,
  SCENARIO_TYPES,
  RELATIONSHIP_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_FRAMES,
} from "~/lib/admin/diplomatic-scenario-transforms";
import { DiplomaticChoiceEditor } from "./DiplomaticChoiceEditor";

interface DiplomaticScenarioFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ScenarioFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScenarioFormData>>;
  responseOptions: ChoiceFormData[];
  setResponseOptions: (options: ChoiceFormData[]) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  choiceFormData: ChoiceFormData;
  setChoiceFormData: React.Dispatch<React.SetStateAction<ChoiceFormData>>;
  editingChoiceIndex: number | null;
  countries: any[];
  onAddChoice: () => void;
  onEditChoice: (index: number) => void;
  onSaveChoice: () => void;
  onDeleteChoice: (index: number) => void;
  onCancelChoiceEdit: () => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

export function DiplomaticScenarioFormDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  responseOptions,
  activeTab,
  setActiveTab,
  choiceFormData,
  setChoiceFormData,
  editingChoiceIndex,
  countries,
  onAddChoice,
  onEditChoice,
  onSaveChoice,
  onDeleteChoice,
  onCancelChoiceEdit,
  onClose,
  onSave,
  isPending,
}: DiplomaticScenarioFormDialogProps) {
  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "narrative", label: "Narrative", icon: FileText },
    { id: "choices", label: "Choices", icon: List },
    { id: "metadata", label: "Metadata", icon: Target },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Scenario" : "Add Scenario"}</DialogTitle>
          <DialogDescription>
            Configure diplomatic scenario template with player choices
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto">
            <TabsContent value="general">
              <GeneralTab formData={formData} setFormData={setFormData} countries={countries} />
            </TabsContent>
            <TabsContent value="narrative">
              <NarrativeTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="choices">
              <DiplomaticChoiceEditor
                responseOptions={responseOptions}
                choiceFormData={choiceFormData}
                setChoiceFormData={setChoiceFormData}
                editingChoiceIndex={editingChoiceIndex}
                onAddChoice={onAddChoice}
                onEditChoice={onEditChoice}
                onSaveChoice={onSaveChoice}
                onDeleteChoice={onDeleteChoice}
                onCancelChoiceEdit={onCancelChoiceEdit}
              />
            </TabsContent>
            <TabsContent value="metadata">
              <MetadataTab formData={formData} setFormData={setFormData} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="shrink-0 border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={
              !formData.title ||
              !formData.narrative ||
              !formData.country1Id ||
              !formData.country2Id ||
              isPending
            }
            className="bg-red-500/20 text-red-500 hover:bg-red-500/30"
          >
            {isPending ? "Saving..." : isEditing ? "Update Scenario" : "Create Scenario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneralTab({
  formData,
  setFormData,
  countries,
}: {
  formData: ScenarioFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScenarioFormData>>;
  countries?: any[];
}) {
  const [country1Search, setCountry1Search] = useState("");
  const [country2Search, setCountry2Search] = useState("");

  const filteredCountries1 = useMemo(() => {
    if (!countries) return [];
    if (!country1Search) return countries;
    const search = country1Search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.shortName?.toLowerCase().includes(search) ||
        c.continent?.toLowerCase().includes(search)
    );
  }, [countries, country1Search]);

  const filteredCountries2 = useMemo(() => {
    if (!countries) return [];
    if (!country2Search) return countries;
    const search = country2Search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.shortName?.toLowerCase().includes(search) ||
        c.continent?.toLowerCase().includes(search)
    );
  }, [countries, country2Search]);

  const selectedCountry1 = countries?.find((c) => c.id === formData.country1Id);
  const selectedCountry2 = countries?.find((c) => c.id === formData.country2Id);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Scenario Type *</label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENARIO_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="e.g., Border Patrol Incident Escalates Tensions"
          maxLength={500}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Country 1 *</label>
          <Select
            value={formData.country1Id}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, country1Id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country...">
                {selectedCountry1 && (
                  <div className="flex items-center gap-2">
                    {selectedCountry1.flagUrl && (
                      <img
                        src={selectedCountry1.flagUrl}
                        alt={selectedCountry1.name}
                        className="h-4 w-6 object-cover"
                      />
                    )}
                    <span className="truncate">{selectedCountry1.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <div className="border-b border-white/10 p-2">
                <Input
                  placeholder="Search countries..."
                  value={country1Search}
                  onChange={(e) => setCountry1Search(e.target.value)}
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {filteredCountries1.length === 0 ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    No countries found
                  </div>
                ) : (
                  filteredCountries1.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      <div className="flex items-center gap-2">
                        {country.flagUrl && (
                          <img
                            src={country.flagUrl}
                            alt={country.name}
                            className="h-4 w-6 object-cover"
                          />
                        )}
                        <span className="flex-1 truncate">{country.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {country.economicTier || "N/A"}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </div>
            </SelectContent>
          </Select>
          {selectedCountry1 && (
            <p className="text-muted-foreground mt-1 text-xs">
              {selectedCountry1.continent} • {selectedCountry1.economicTier || "No tier"}
            </p>
          )}
        </div>
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Country 2 *</label>
          <Select
            value={formData.country2Id}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, country2Id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country...">
                {selectedCountry2 && (
                  <div className="flex items-center gap-2">
                    {selectedCountry2.flagUrl && (
                      <img
                        src={selectedCountry2.flagUrl}
                        alt={selectedCountry2.name}
                        className="h-4 w-6 object-cover"
                      />
                    )}
                    <span className="truncate">{selectedCountry2.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <div className="border-b border-white/10 p-2">
                <Input
                  placeholder="Search countries..."
                  value={country2Search}
                  onChange={(e) => setCountry2Search(e.target.value)}
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {filteredCountries2.length === 0 ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    No countries found
                  </div>
                ) : (
                  filteredCountries2.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      <div className="flex items-center gap-2">
                        {country.flagUrl && (
                          <img
                            src={country.flagUrl}
                            alt={country.name}
                            className="h-4 w-6 object-cover"
                          />
                        )}
                        <span className="flex-1 truncate">{country.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {country.economicTier || "N/A"}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </div>
            </SelectContent>
          </Select>
          {selectedCountry2 && (
            <p className="text-muted-foreground mt-1 text-xs">
              {selectedCountry2.continent} • {selectedCountry2.economicTier || "No tier"}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Relationship Level
          </label>
          <Select
            value={formData.relationshipState}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, relationshipState: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Relationship Strength: {formData.relationshipStrength}
          </label>
          <Input
            type="number"
            value={formData.relationshipStrength}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                relationshipStrength: parseFloat(e.target.value) || 0,
              }))
            }
            min={0}
            max={100}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Difficulty</label>
          <Select
            value={formData.difficulty}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, difficulty: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Time Frame</label>
          <Select
            value={formData.timeFrame}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, timeFrame: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FRAMES.map((frame) => (
                <SelectItem key={frame.value} value={frame.value}>
                  {frame.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Status</label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function NarrativeTab({
  formData,
  setFormData,
}: {
  formData: ScenarioFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScenarioFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Narrative *</label>
        <Textarea
          value={formData.narrative}
          onChange={(e) => setFormData((prev) => ({ ...prev, narrative: e.target.value }))}
          placeholder="Rich narrative describing the scenario (3-5 paragraphs)..."
          rows={15}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Provide context, situation, implications, and urgency. This will be displayed to players.
        </p>
      </div>
    </div>
  );
}

function MetadataTab({
  formData,
  setFormData,
}: {
  formData: ScenarioFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScenarioFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Cultural Impact: {formData.culturalImpact}
          </label>
          <Input
            type="number"
            value={formData.culturalImpact}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                culturalImpact: parseFloat(e.target.value) || 0,
              }))
            }
            min={0}
            max={100}
          />
          <p className="text-muted-foreground mt-1 text-xs">0-100 scale</p>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Diplomatic Risk: {formData.diplomaticRisk}
          </label>
          <Input
            type="number"
            value={formData.diplomaticRisk}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                diplomaticRisk: parseFloat(e.target.value) || 0,
              }))
            }
            min={0}
            max={100}
          />
          <p className="text-muted-foreground mt-1 text-xs">0-100 scale</p>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Economic Cost: {formData.economicCost}
          </label>
          <Input
            type="number"
            value={formData.economicCost}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                economicCost: parseFloat(e.target.value) || 0,
              }))
            }
            min={0}
            max={100}
          />
          <p className="text-muted-foreground mt-1 text-xs">0-100 scale</p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
        <h4 className="text-foreground mb-2 text-sm font-medium">Scenario Guidelines</h4>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>• Cultural Impact: How much this affects cultural ties and mutual understanding</li>
          <li>• Diplomatic Risk: Potential for relationship damage or escalation</li>
          <li>• Economic Cost: Financial resources required to address the scenario</li>
          <li>• Time Frame determines expiry duration (3-30 days)</li>
          <li>• Difficulty affects AI selection probability and rewards</li>
        </ul>
      </div>
    </div>
  );
}
