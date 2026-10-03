"use client";
// src/app/admin/npc-personalities/NPCPersonalitiesPanel.tsx
// Unified NPC Personality Archetypes Admin Panel with standard iconoir icons

import { RowActions } from "../_components/RowActions";
import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { Search, Plus, Globe } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import {
  NPCPersonalityFormDialog,
  type PersonalityFormData,
  ARCHETYPES,
} from "./_components/NPCPersonalityFormDialog";
import { NPCPersonalityAssignDialog } from "./_components/NPCPersonalityAssignDialog";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

export function NPCPersonalitiesPanel() {
  usePageTitle({ title: "Admin - NPC Personalities" });

  const notify = useNotify();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState<string>("all");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPersonality, setEditingPersonality] = useState<any | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigningPersonality, setAssigningPersonality] = useState<any | null>(null);
  const [assignCountryId, setAssignCountryId] = useState("");
  const [assignReason, setAssignReason] = useState("");

  // Form State
  const [formData, setFormData] = useState<PersonalityFormData>({
    name: "",
    archetype: "pragmatic_realist",
    historicalBasis: "",
    historicalContext: "",
    isActive: true,
    traits: {
      assertiveness: 50,
      cooperativeness: 50,
      militarism: 50,
      culturalOpenness: 50,
      economicFocus: 50,
      diplomaticTendency: 50,
      riskTolerance: 50,
      ideologicalRigidity: 50,
    },
  });

  // Queries
  const {
    data: personalities,
    refetch,
    isLoading,
  } = api.npcPersonalities.getAllPersonalities.useQuery({
    archetype: archetypeFilter === "all" ? undefined : (archetypeFilter as any),
    isActive: showActiveOnly ? true : undefined,
    orderBy: "usageCount",
  });

  // Mutations
  const createMutation = api.npcPersonalities.createPersonality.useMutation({
    onSuccess: () => {
      notify.success("Success", "Personality created successfully");
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create personality");
    },
  });

  const updateMutation = api.npcPersonalities.updatePersonality.useMutation({
    onSuccess: () => {
      notify.success("Success", "Personality updated successfully");
      refetch();
      setEditingPersonality(null);
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update personality");
    },
  });

  const deleteMutation = api.npcPersonalities.deletePersonality.useMutation({
    onSuccess: () => {
      notify.success("Success", "Personality deleted successfully");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to delete personality");
    },
  });

  const assignMutation = api.npcPersonalities.assignPersonalityToCountry.useMutation({
    onSuccess: () => {
      notify.success("Success", "Personality assigned to country successfully");
      setIsAssignDialogOpen(false);
      setAssigningPersonality(null);
      setAssignCountryId("");
      setAssignReason("");
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to assign personality");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      archetype: "pragmatic_realist",
      historicalBasis: "",
      historicalContext: "",
      isActive: true,
      traits: {
        assertiveness: 50,
        cooperativeness: 50,
        militarism: 50,
        culturalOpenness: 50,
        economicFocus: 50,
        diplomaticTendency: 50,
        riskTolerance: 50,
        ideologicalRigidity: 50,
      },
    });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      notify.error("Validation Error", "Please enter a name");
      return;
    }

    createMutation.mutate({
      name: formData.name,
      archetype: formData.archetype as any,
      traits: {
        assertiveness: formData.traits.assertiveness,
        cooperativeness: formData.traits.cooperativeness,
        militarism: formData.traits.militarism,
        culturalOpenness: formData.traits.culturalOpenness,
        economicFocus: formData.traits.economicFocus,
        riskTolerance: formData.traits.riskTolerance,
        ideologicalRigidity: formData.traits.ideologicalRigidity,
        isolationism: 100 - formData.traits.diplomaticTendency,
      },
      traitDescriptions: {},
      culturalProfile: {
        formality: 50,
        directness: 50,
        emotionality: 50,
        flexibility: 50,
        negotiationStyle: "Balanced",
      },
      toneMatrix: {},
      responsePatterns: [],
      scenarioResponses: {},
      eventModifiers: {},
      historicalBasis: formData.historicalBasis,
      historicalContext: formData.historicalContext,
    });
  };

  const handleUpdate = () => {
    if (!editingPersonality) return;

    updateMutation.mutate({
      id: editingPersonality.id,
      name: formData.name,
      traits: {
        assertiveness: formData.traits.assertiveness,
        cooperativeness: formData.traits.cooperativeness,
        militarism: formData.traits.militarism,
        culturalOpenness: formData.traits.culturalOpenness,
        economicFocus: formData.traits.economicFocus,
        riskTolerance: formData.traits.riskTolerance,
        ideologicalRigidity: formData.traits.ideologicalRigidity,
        isolationism: 100 - formData.traits.diplomaticTendency,
      },
      historicalBasis: formData.historicalBasis,
      historicalContext: formData.historicalContext,
    });
  };

  const handleEdit = (personality: any) => {
    setEditingPersonality(personality);
    setFormData({
      name: personality.name,
      archetype: personality.archetype,
      historicalBasis: personality.historicalBasis || "",
      historicalContext: personality.historicalContext || "",
      isActive: personality.isActive,
      traits: {
        assertiveness: personality.traits?.assertiveness ?? 50,
        cooperativeness: personality.traits?.cooperativeness ?? 50,
        militarism: personality.traits?.militarism ?? 50,
        culturalOpenness: personality.traits?.culturalOpenness ?? 50,
        economicFocus: personality.traits?.economicFocus ?? 50,
        diplomaticTendency: 100 - (personality.traits?.isolationism ?? 50),
        riskTolerance: personality.traits?.riskTolerance ?? 50,
        ideologicalRigidity: personality.traits?.ideologicalRigidity ?? 50,
      },
    });
  };

  const handleClone = (personality: any) => {
    setFormData({
      name: `${personality.name} (Clone)`,
      archetype: personality.archetype,
      historicalBasis: personality.historicalBasis || "",
      historicalContext: personality.historicalContext || "",
      isActive: true,
      traits: {
        assertiveness: personality.traits?.assertiveness ?? 50,
        cooperativeness: personality.traits?.cooperativeness ?? 50,
        militarism: personality.traits?.militarism ?? 50,
        culturalOpenness: personality.traits?.culturalOpenness ?? 50,
        economicFocus: personality.traits?.economicFocus ?? 50,
        diplomaticTendency: 100 - (personality.traits?.isolationism ?? 50),
        riskTolerance: personality.traits?.riskTolerance ?? 50,
        ideologicalRigidity: personality.traits?.ideologicalRigidity ?? 50,
      },
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const filteredPersonalities = useMemo(() => {
    if (!personalities) return [];
    return personalities.filter((p) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        (p.historicalBasis && p.historicalBasis.toLowerCase().includes(term))
      );
    });
  }, [personalities, searchTerm]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="NPC personalities"
        subtitle="Diplomatic behavior profiles, decision parameters and nation assignments."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Total archetypes</div>
          <div className="text-label text-title-2 mt-1 tabular-nums">
            {personalities?.length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Active profiles</div>
          <div className="text-title-2 text-green mt-1 tabular-nums">
            {personalities?.filter((p: any) => p.isActive).length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Total assignments</div>
          <div className="text-title-2 text-teal mt-1 tabular-nums">
            {personalities?.reduce((acc: number, p: any) => acc + (p.usageCount || 0), 0) ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-label-secondary text-stat-label">Filtered roster</div>
          <div className="text-title-2 text-purple mt-1 tabular-nums">
            {filteredPersonalities.length}
          </div>
        </Card>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Filter personalities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <Select value={archetypeFilter} onValueChange={setArchetypeFilter}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="All archetypes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All archetypes</SelectItem>
              {ARCHETYPES.map((arch) => (
                <SelectItem key={arch.value} value={arch.value} className="text-footnote">
                  {arch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-2 px-2 select-none">
            <Checkbox
              id="npc-active-only"
              checked={showActiveOnly}
              onCheckedChange={(checked) => setShowActiveOnly(!!checked)}
              className="h-3.5 w-3.5"
            />
            <span>Active only</span>
          </label>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add personality
        </Button>
      </div>

      {/* High-Density Inset Glass Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-12 w-full" />
          ))}
        </div>
      ) : filteredPersonalities.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-label-secondary text-footnote">No personalities matching criteria.</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Personality & basis</TableHead>
                <TableHead className="px-4">Archetype</TableHead>
                <TableHead className="px-4">Core traits</TableHead>
                <TableHead className="px-4">Usage</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPersonalities.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="px-4">
                    <div className="text-label font-semibold">{p.name}</div>
                    {p.historicalBasis && (
                      <div className="text-label-secondary text-footnote max-w-xs truncate">
                        {p.historicalBasis}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant="info" className="capitalize">
                      {p.archetype.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="text-label-secondary text-footnote flex items-center gap-3 font-mono">
                      <span>
                        Mil: <strong className="text-label">{p.traits?.militarism ?? 50}%</strong>
                      </span>
                      <span>
                        Coop:{" "}
                        <strong className="text-label">{p.traits?.cooperativeness ?? 50}%</strong>
                      </span>
                      <span>
                        Risk:{" "}
                        <strong className="text-label">{p.traits?.riskTolerance ?? 50}%</strong>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-label px-4 font-medium">
                    {p.usageCount || 0}×
                  </TableCell>
                  <TableCell className="px-4">
                    {p.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge
                        className="bg-fill-3 text-label-secondary border-separator"
                        variant="secondary"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <RowActions
                      before={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Assign to country"
                          onClick={() => {
                            setAssigningPersonality(p);
                            setIsAssignDialogOpen(true);
                          }}

                          title="Assign to country"
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </Button>
                      }
                      onClone={() => handleClone(p)}
                      onEdit={() => handleEdit(p)}
                      onDelete={() => handleDelete(p.id, p.name)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Form Dialog */}
      {(isAddDialogOpen || !!editingPersonality) && (
        <NPCPersonalityFormDialog
          isOpen={isAddDialogOpen || !!editingPersonality}
          isEditing={!!editingPersonality}
          formData={formData}
          setFormData={setFormData}
          onClose={() => {
            setIsAddDialogOpen(false);
            setEditingPersonality(null);
            resetForm();
          }}
          onSave={editingPersonality ? handleUpdate : handleCreate}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Assign Dialog */}
      {isAssignDialogOpen && (
        <NPCPersonalityAssignDialog
          isOpen={isAssignDialogOpen}
          personality={assigningPersonality}
          countryId={assignCountryId}
          setCountryId={setAssignCountryId}
          reason={assignReason}
          setReason={setAssignReason}
          onClose={() => {
            setIsAssignDialogOpen(false);
            setAssigningPersonality(null);
          }}
          onAssign={() =>
            assignMutation.mutate({
              countryId: assignCountryId.trim(),
              personalityId: assigningPersonality.id,
              reason: assignReason || undefined,
            })
          }
          isPending={assignMutation.isPending}
        />
      )}
    </div>
  );
}
