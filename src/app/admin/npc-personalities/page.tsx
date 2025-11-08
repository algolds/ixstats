"use client";

/**
 * NPC Personalities Admin Interface
 *
 * Comprehensive admin page for managing NPC personality archetypes.
 *
 * Features:
 * - Personality catalog with card grid view
 * - Filter by archetype, active status
 * - Search by name, historical basis
 * - View personality details and traits
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Clone personality functionality
 * - Assign personalities to countries
 * - Usage statistics and analytics
 * - Interactive trait sliders (8 traits)
 * - Glass physics design
 */

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/toast";
import {
  RiSearchLine,
  RiFilterLine,
  RiUser3Line,
  RiBarChartBoxLine,
  RiCheckLine,
  RiCloseLine,
  RiHistoryLine,
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiTeamLine,
} from "react-icons/ri";

// Archetype options (6 archetypes)
const ARCHETYPES = [
  { value: "aggressive_expansionist", label: "Aggressive Expansionist", color: "red" },
  { value: "peaceful_merchant", label: "Peaceful Merchant", color: "green" },
  { value: "cautious_isolationist", label: "Cautious Isolationist", color: "gray" },
  { value: "cultural_diplomat", label: "Cultural Diplomat", color: "purple" },
  { value: "pragmatic_realist", label: "Pragmatic Realist", color: "blue" },
  { value: "ideological_hardliner", label: "Ideological Hardliner", color: "orange" },
];

// Personality form data interface
interface PersonalityFormData {
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

export default function NPCPersonalitiesPage() {
  const { toast } = useToast();

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState<string>("all");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPersonality, setEditingPersonality] = useState<any | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigningPersonality, setAssigningPersonality] = useState<any | null>(null);
  const [assignCountryId, setAssignCountryId] = useState("");
  const [assignReason, setAssignReason] = useState("");

  // Form state
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

  // Data fetching
  const {
    data: personalities,
    refetch,
    isLoading,
  } = api.npcPersonalities.getAllPersonalities.useQuery({
    archetype: archetypeFilter === "all" ? undefined : (archetypeFilter as any),
    isActive: showActiveOnly ? true : undefined,
    orderBy: "usageCount",
  });

  const { data: stats } = api.npcPersonalities.getPersonalityStats.useQuery();

  // Mutations
  const createMutation = api.npcPersonalities.createPersonality.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Personality created successfully",
        type: "success",
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create personality",
        type: "error",
      });
    },
  });

  const updateMutation = api.npcPersonalities.updatePersonality.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Personality updated successfully",
        type: "success",
      });
      refetch();
      setEditingPersonality(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update personality",
        type: "error",
      });
    },
  });

  const deleteMutation = api.npcPersonalities.deletePersonality.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Personality deleted successfully",
        type: "success",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete personality",
        type: "error",
      });
    },
  });

  const assignMutation = api.npcPersonalities.assignPersonalityToCountry.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Personality assigned to country successfully",
        type: "success",
      });
      setIsAssignDialogOpen(false);
      setAssigningPersonality(null);
      setAssignCountryId("");
      setAssignReason("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign personality",
        type: "error",
      });
    },
  });

  // Handlers
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
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a name for the personality",
        type: "error",
      });
      return;
    }

    // Prepare data for API (need to match schema)
    const traitDescriptions: Record<string, string> = {
      assertiveness: "Leadership and decisiveness in international affairs",
      cooperativeness: "Willingness to collaborate and compromise",
      militarism: "Preference for military solutions and strength",
      culturalOpenness: "Receptiveness to foreign cultures and ideas",
      economicFocus: "Priority given to economic considerations",
      diplomaticTendency: "Preference for diplomatic solutions",
      riskTolerance: "Willingness to take risks in foreign policy",
      ideologicalRigidity: "Adherence to ideological principles",
    };

    const culturalProfile = {
      formality: 50,
      directness: 50,
      emotionality: 50,
      flexibility: 50,
      negotiationStyle: "Balanced approach",
    };

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
        isolationism: 100 - formData.traits.diplomaticTendency, // Inverse of diplomatic tendency
      },
      traitDescriptions,
      culturalProfile,
      toneMatrix: {},
      responsePatterns: [],
      scenarioResponses: {},
      eventModifiers: {},
      historicalBasis: formData.historicalBasis,
      historicalContext: formData.historicalContext,
    });
  };

  const handleUpdate = () => {
    if (!editingPersonality?.id) return;

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

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This will mark it as inactive.`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (personality: any) => {
    setFormData({
      name: personality.name,
      archetype: personality.archetype,
      historicalBasis: personality.historicalBasis || "",
      historicalContext: personality.historicalContext || "",
      isActive: personality.isActive,
      traits: {
        assertiveness: personality.assertiveness,
        cooperativeness: personality.cooperativeness,
        militarism: personality.militarism,
        culturalOpenness: personality.culturalOpenness,
        economicFocus: personality.economicFocus,
        diplomaticTendency: 100 - personality.isolationism, // Inverse
        riskTolerance: personality.riskTolerance,
        ideologicalRigidity: personality.ideologicalRigidity,
      },
    });
    setEditingPersonality(personality);
  };

  const handleClone = (personality: any) => {
    setFormData({
      name: `${personality.name} (Copy)`,
      archetype: personality.archetype,
      historicalBasis: personality.historicalBasis || "",
      historicalContext: personality.historicalContext || "",
      isActive: true,
      traits: {
        assertiveness: personality.assertiveness,
        cooperativeness: personality.cooperativeness,
        militarism: personality.militarism,
        culturalOpenness: personality.culturalOpenness,
        economicFocus: personality.economicFocus,
        diplomaticTendency: 100 - personality.isolationism,
        riskTolerance: personality.riskTolerance,
        ideologicalRigidity: personality.ideologicalRigidity,
      },
    });
    setIsAddDialogOpen(true);
  };

  const handleAssign = (personality: any) => {
    setAssigningPersonality(personality);
    setIsAssignDialogOpen(true);
  };

  const handleAssignSubmit = () => {
    if (!assigningPersonality || !assignCountryId) {
      toast({
        title: "Validation Error",
        description: "Please enter a country ID",
        type: "error",
      });
      return;
    }

    assignMutation.mutate({
      personalityId: assigningPersonality.id,
      countryId: assignCountryId,
      reason: assignReason || undefined,
    });
  };

  // Filtering
  const filteredPersonalities = useMemo(() => {
    if (!personalities) return [];

    return personalities.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.historicalBasis && p.historicalBasis.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [personalities, searchTerm]);

  // Archetype display helper
  const getArchetypeColor = (archetype: string) => {
    const colors: Record<string, string> = {
      aggressive_expansionist: "bg-red-500/20 text-red-400 border-red-500/30",
      peaceful_merchant: "bg-green-500/20 text-green-400 border-green-500/30",
      cautious_isolationist: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      cultural_diplomat: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      pragmatic_realist: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      ideological_hardliner: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };
    return colors[archetype] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="glass-card-parent rounded-xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
                <RiUser3Line className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                  NPC Personality Manager
                </h1>
                <p className="text-muted-foreground text-sm">
                  Configure AI personality archetypes for NPC countries
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <RiAddLine className="mr-2 h-4 w-4" />
              Create Personality
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="glass-card-child border-purple-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-2xl font-bold">
                  {stats.summary.totalPersonalities}
                </CardTitle>
                <CardDescription>Total Personalities</CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card-child border-green-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold text-green-400">
                  {stats.summary.activePersonalities}
                </CardTitle>
                <CardDescription>Active Archetypes</CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card-child border-blue-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold text-blue-400">
                  {stats.summary.totalAssignments}
                </CardTitle>
                <CardDescription>Country Assignments</CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-card-child border-purple-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold text-purple-400">
                  {stats.summary.averageUsage}
                </CardTitle>
                <CardDescription>Average Usage</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="glass-card-child border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="min-w-[300px] flex-1">
                <div className="relative">
                  <RiSearchLine className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search by name or historical figure..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Archetype Filter */}
              <Select value={archetypeFilter} onValueChange={setArchetypeFilter}>
                <SelectTrigger className="w-[220px]">
                  <RiFilterLine className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by archetype" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Archetypes</SelectItem>
                  <SelectItem value="aggressive_expansionist">Aggressive Expansionist</SelectItem>
                  <SelectItem value="peaceful_merchant">Peaceful Merchant</SelectItem>
                  <SelectItem value="cautious_isolationist">Cautious Isolationist</SelectItem>
                  <SelectItem value="cultural_diplomat">Cultural Diplomat</SelectItem>
                  <SelectItem value="pragmatic_realist">Pragmatic Realist</SelectItem>
                  <SelectItem value="ideological_hardliner">Ideological Hardliner</SelectItem>
                </SelectContent>
              </Select>

              {/* Active Filter */}
              <Button
                variant={showActiveOnly ? "default" : "outline"}
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                className="gap-2"
              >
                {showActiveOnly ? <RiCheckLine className="h-4 w-4" /> : <RiCloseLine className="h-4 w-4" />}
                Active Only
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personalities Grid */}
        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center">Loading personalities...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPersonalities.map((personality) => (
              <Card
                key={personality.id}
                className="glass-card-interactive border-purple-500/20 transition-all hover:border-purple-500/40"
              >
              <CardHeader>
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-foreground text-lg font-bold">
                      {personality.name}
                    </CardTitle>
                    <Badge className={`mt-2 ${getArchetypeColor(personality.archetype)}`}>
                      {personality.archetype.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                      <RiBarChartBoxLine className="mr-1" />
                      {personality.usageCount} uses
                    </Badge>
                    {personality.isActive ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-400">
                        <RiCheckLine className="mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-500/30 text-gray-400">
                        <RiCloseLine className="mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>

                {personality.historicalBasis && (
                  <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3 text-sm text-[--intel-silver]">
                    <RiHistoryLine className="text-purple-400" />
                    <span>
                      Inspired by:{" "}
                      <span className="font-medium text-purple-400">
                        {personality.historicalBasis}
                      </span>
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {/* Trait Bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[--intel-silver]">Assertiveness</span>
                        <span className="text-foreground font-medium">
                          {personality.assertiveness}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-400"
                          style={{ width: `${personality.assertiveness}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[--intel-silver]">Cooperativeness</span>
                        <span className="text-foreground font-medium">
                          {personality.cooperativeness}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400"
                          style={{ width: `${personality.cooperativeness}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[--intel-silver]">Militarism</span>
                        <span className="text-foreground font-medium">
                          {personality.militarism}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                          style={{ width: `${personality.militarism}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[--intel-silver]">Cultural Openness</span>
                        <span className="text-foreground font-medium">
                          {personality.culturalOpenness}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                          style={{ width: `${personality.culturalOpenness}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Historical Context (truncated) */}
                  {personality.historicalContext && (
                    <div className="border-t border-white/5 pt-3 text-xs text-[--intel-silver]">
                      {personality.historicalContext.slice(0, 120)}...
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 border-t border-white/5 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(personality)}
                      className="flex-1 text-xs"
                    >
                      <RiEditLine className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClone(personality)}
                      className="text-xs"
                      title="Clone personality"
                    >
                      <RiFileCopyLine className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAssign(personality)}
                      className="text-xs"
                      title="Assign to country"
                    >
                      <RiTeamLine className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(personality.id, personality.name)}
                      className="text-xs text-red-400 hover:text-red-300"
                      title="Delete personality"
                    >
                      <RiDeleteBinLine className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

        {/* Empty State */}
        {!isLoading && filteredPersonalities.length === 0 && (
          <Card className="glass-card-child border-purple-500/20">
            <CardContent className="py-12 text-center">
              <RiUser3Line className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-bold">No Personalities Found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search term</p>
            </CardContent>
          </Card>
        )}

        {/* Personality Editor Dialog */}
        <Dialog
        open={isAddDialogOpen || !!editingPersonality}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingPersonality(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPersonality ? "Edit Personality" : "Create New Personality"}
            </DialogTitle>
            <DialogDescription>
              Configure personality traits, archetype, and historical context for NPC countries
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Winston Churchill Archetype"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Archetype</label>
                <Select
                  value={formData.archetype}
                  onValueChange={(value) => setFormData({ ...formData, archetype: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARCHETYPES.map((archetype) => (
                      <SelectItem key={archetype.value} value={archetype.value}>
                        {archetype.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Historical Basis (Optional)
                </label>
                <Input
                  value={formData.historicalBasis}
                  onChange={(e) => setFormData({ ...formData, historicalBasis: e.target.value })}
                  placeholder="e.g., Winston Churchill, Otto von Bismarck"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Historical Context (Optional)
                </label>
                <Textarea
                  value={formData.historicalContext}
                  onChange={(e) => setFormData({ ...formData, historicalContext: e.target.value })}
                  placeholder="Provide historical background and context for this personality..."
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked as boolean })
                  }
                />
                <label htmlFor="isActive" className="text-foreground cursor-pointer text-sm">
                  Active (available for assignment)
                </label>
              </div>
            </div>

            {/* Personality Traits */}
            <div className="space-y-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
              <h3 className="text-foreground text-lg font-semibold">Personality Traits</h3>
              <p className="text-sm text-[--intel-silver]">
                Adjust the 8 core personality traits (0-100 scale)
              </p>

              {/* Assertiveness */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Assertiveness</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.assertiveness}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.assertiveness]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, assertiveness: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Leadership and decisiveness in international affairs
                </p>
              </div>

              {/* Cooperativeness */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Cooperativeness</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.cooperativeness}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.cooperativeness]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, cooperativeness: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Willingness to collaborate and compromise
                </p>
              </div>

              {/* Militarism */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Militarism</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.militarism}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.militarism]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, militarism: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Preference for military solutions and strength
                </p>
              </div>

              {/* Cultural Openness */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Cultural Openness</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.culturalOpenness}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.culturalOpenness]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, culturalOpenness: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Receptiveness to foreign cultures and ideas
                </p>
              </div>

              {/* Economic Focus */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Economic Focus</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.economicFocus}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.economicFocus]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, economicFocus: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Priority given to economic considerations
                </p>
              </div>

              {/* Diplomatic Tendency */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Diplomatic Tendency</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.diplomaticTendency}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.diplomaticTendency]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, diplomaticTendency: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Preference for diplomatic solutions (inverse of isolationism)
                </p>
              </div>

              {/* Risk Tolerance */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">Risk Tolerance</label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.riskTolerance}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.riskTolerance]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, riskTolerance: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Willingness to take risks in foreign policy
                </p>
              </div>

              {/* Ideological Rigidity */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-foreground text-sm font-medium">
                    Ideological Rigidity
                  </label>
                  <span className="text-foreground rounded bg-black/30 px-2 py-1 text-sm font-bold">
                    {formData.traits.ideologicalRigidity}
                  </span>
                </div>
                <Slider
                  value={[formData.traits.ideologicalRigidity]}
                  onValueChange={([value]) =>
                    setFormData({
                      ...formData,
                      traits: { ...formData.traits, ideologicalRigidity: value ?? 50 },
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  Adherence to ideological principles (vs pragmatism)
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingPersonality(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingPersonality ? handleUpdate : handleCreate}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingPersonality
                  ? "Update Personality"
                  : "Create Personality"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Country Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Personality to Country</DialogTitle>
            <DialogDescription>
              Assign &ldquo;{assigningPersonality?.name}&rdquo; to an NPC country
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Country ID <span className="text-red-400">*</span>
              </label>
              <Input
                value={assignCountryId}
                onChange={(e) => setAssignCountryId(e.target.value)}
                placeholder="Enter country CUID"
              />
              <p className="mt-1 text-xs text-[--intel-silver]">
                The unique ID of the country to assign this personality to
              </p>
            </div>

            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Reason (Optional)
              </label>
              <Textarea
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                placeholder="Why this personality fits this country..."
                rows={3}
              />
            </div>

            {assigningPersonality && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                <p className="text-foreground mb-2 text-sm font-medium">
                  {assigningPersonality.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={getArchetypeColor(assigningPersonality.archetype)}>
                    {assigningPersonality.archetype.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                    {assigningPersonality.usageCount} uses
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAssignDialogOpen(false);
                setAssigningPersonality(null);
                setAssignCountryId("");
                setAssignReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignSubmit}
              disabled={!assignCountryId || assignMutation.isPending}
              className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Personality"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
