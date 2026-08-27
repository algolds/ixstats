// src/app/admin/npc-personalities/NPCPersonalitiesPanel.tsx
// Unified NPC Personality Archetypes Admin Panel with standard iconoir icons
"use client";

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
import {
  Search,
  Plus,
  EditPencil as Pencil,
  Trash as Trash2,
  Copy,
  User,
  Globe,
} from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";
import {
  NPCPersonalityFormDialog,
  type PersonalityFormData,
  ARCHETYPES,
} from "./_components/NPCPersonalityFormDialog";
import { NPCPersonalityAssignDialog } from "./_components/NPCPersonalityAssignDialog";
import { Skeleton } from "~/components/ui/skeleton";

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
      <AdminHeader
        icon={User}
        title="NPC Personality Archetypes"
        description="Configure automated diplomatic behavior profiles, strategic decision parameters, and nation assignments."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 backdrop-blur-md">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Archetypes
          </div>
          <div className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {personalities?.length ?? 0}
          </div>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 backdrop-blur-md">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Profiles
          </div>
          <div className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-500">
            {personalities?.filter((p: any) => p.isActive).length ?? 0}
          </div>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 backdrop-blur-md">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Assignments
          </div>
          <div className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-500">
            {personalities?.reduce((acc: number, p: any) => acc + (p.usageCount || 0), 0) ?? 0}
          </div>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 backdrop-blur-md">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Filtered Roster
          </div>
          <div className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-500">
            {filteredPersonalities.length}
          </div>
        </div>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Filter personalities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border/30 bg-background/50 focus:border-border/60 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
            />
          </div>

          <Select value={archetypeFilter} onValueChange={setArchetypeFilter}>
            <SelectTrigger className="border-border/30 bg-background/50 h-8 w-44 rounded-xl text-xs backdrop-blur-md">
              <SelectValue placeholder="All Archetypes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Archetypes</SelectItem>
              {ARCHETYPES.map((arch) => (
                <SelectItem key={arch.value} value={arch.value} className="text-xs">
                  {arch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 px-2 text-xs select-none">
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
          className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Personality
        </Button>
      </div>

      {/* High-Density Inset Glass Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredPersonalities.length === 0 ? (
        <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
          <p className="text-muted-foreground text-xs">No personalities matching criteria.</p>
        </div>
      ) : (
        <div className="border-border/30 bg-card/25 overflow-x-auto rounded-2xl border shadow-xs backdrop-blur-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-border/30 bg-muted/20 text-muted-foreground border-b font-semibold">
                <th className="px-4 py-2.5 text-left font-medium">Personality & Basis</th>
                <th className="px-4 py-2.5 text-left font-medium">Archetype</th>
                <th className="px-4 py-2.5 text-left font-medium">Core Traits</th>
                <th className="px-4 py-2.5 text-left font-medium">Usage</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border/15 divide-y">
              {filteredPersonalities.map((p: any) => (
                <tr key={p.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="text-foreground font-semibold">{p.name}</div>
                    {p.historicalBasis && (
                      <div className="text-muted-foreground max-w-xs truncate text-[11px]">
                        {p.historicalBasis}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400 capitalize">
                      {p.archetype.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-muted-foreground flex items-center gap-3 font-mono text-[11px]">
                      <span>
                        Mil:{" "}
                        <strong className="text-foreground">{p.traits?.militarism ?? 50}%</strong>
                      </span>
                      <span>
                        Coop:{" "}
                        <strong className="text-foreground">
                          {p.traits?.cooperativeness ?? 50}%
                        </strong>
                      </span>
                      <span>
                        Risk:{" "}
                        <strong className="text-foreground">
                          {p.traits?.riskTolerance ?? 50}%
                        </strong>
                      </span>
                    </div>
                  </td>
                  <td className="text-foreground px-4 py-2.5 font-mono font-medium">
                    {p.usageCount || 0}×
                  </td>
                  <td className="px-4 py-2.5">
                    {p.isActive ? (
                      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-muted-foreground border-border text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => {
                          setAssigningPersonality(p);
                          setIsAssignDialogOpen(true);
                        }}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
                        title="Assign to Country"
                      >
                        <Globe className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleClone(p)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
                        title="Clone"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="rounded-lg p-1 text-red-400 transition-transform hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98]"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

export default NPCPersonalitiesPanel;
