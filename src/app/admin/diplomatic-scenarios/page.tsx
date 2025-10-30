// src/app/admin/diplomatic-scenarios/page.tsx
// Admin interface for managing diplomatic scenarios - dynamic scenario templates with player choices

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowLeft,
  Copy,
  Check,
  X,
  AlertTriangle,
  Clock,
  Filter,
  Globe,
  FileText,
  Settings,
  List,
  Zap,
  Target,
  TrendingUp,
  Shield,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

// Scenario types (12 types)
const SCENARIO_TYPES = [
  { value: 'border_dispute', label: 'Border Dispute', icon: AlertTriangle },
  { value: 'trade_renegotiation', label: 'Trade Renegotiation', icon: TrendingUp },
  { value: 'cultural_misunderstanding', label: 'Cultural Misunderstanding', icon: Globe },
  { value: 'intelligence_breach', label: 'Intelligence Breach', icon: Shield },
  { value: 'humanitarian_crisis', label: 'Humanitarian Crisis', icon: AlertTriangle },
  { value: 'alliance_pressure', label: 'Alliance Pressure', icon: Target },
  { value: 'economic_sanctions_debate', label: 'Economic Sanctions Debate', icon: DollarSign },
  { value: 'technology_transfer_request', label: 'Technology Transfer Request', icon: Zap },
  { value: 'diplomatic_incident', label: 'Diplomatic Incident', icon: AlertTriangle },
  { value: 'mediation_opportunity', label: 'Mediation Opportunity', icon: Globe },
  { value: 'embassy_security_threat', label: 'Embassy Security Threat', icon: Shield },
  { value: 'treaty_renewal', label: 'Treaty Renewal', icon: FileText },
];

// Relationship levels
const RELATIONSHIP_LEVELS = [
  { value: 'hostile', label: 'Hostile', color: 'text-red-400' },
  { value: 'tense', label: 'Tense', color: 'text-orange-400' },
  { value: 'neutral', label: 'Neutral', color: 'text-gray-400' },
  { value: 'friendly', label: 'Friendly', color: 'text-green-400' },
  { value: 'allied', label: 'Allied', color: 'text-blue-400' },
];

// Difficulty levels
const DIFFICULTY_LEVELS = [
  { value: 'trivial', label: 'Trivial', color: 'text-gray-400' },
  { value: 'moderate', label: 'Moderate', color: 'text-blue-400' },
  { value: 'challenging', label: 'Challenging', color: 'text-yellow-400' },
  { value: 'critical', label: 'Critical', color: 'text-orange-400' },
  { value: 'legendary', label: 'Legendary', color: 'text-purple-400' },
];

// Time frames
const TIME_FRAMES = [
  { value: 'urgent', label: 'Urgent (3 days)', duration: 3 },
  { value: 'time_sensitive', label: 'Time Sensitive (1 week)', duration: 7 },
  { value: 'strategic', label: 'Strategic (2 weeks)', duration: 14 },
  { value: 'long_term', label: 'Long Term (1 month)', duration: 30 },
];

// Risk levels for choices
const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'text-green-400' },
  { value: 'medium', label: 'Medium Risk', color: 'text-yellow-400' },
  { value: 'high', label: 'High Risk', color: 'text-orange-400' },
  { value: 'extreme', label: 'Extreme Risk', color: 'text-red-400' },
];

interface ScenarioFormData {
  type: string;
  title: string;
  narrative: string;
  relationshipState: string;
  relationshipStrength: number;
  culturalImpact: number;
  diplomaticRisk: number;
  economicCost: number;
  timeFrame: string;
  difficulty: string;
  status: string;
  country1Id: string;
  country2Id: string;
}

interface ChoiceFormData {
  id: string;
  label: string;
  description: string;
  skillRequired: string;
  skillLevel: number;
  riskLevel: string;
  effects: Record<string, any>;
  predictedOutcomes: Record<string, any>;
}

export default function DiplomaticScenariosPage() {
  usePageTitle({ title: "Diplomatic Scenarios Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [timeFrameFilter, setTimeFrameFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  // Choice editing state
  const [editingChoiceIndex, setEditingChoiceIndex] = useState<number | null>(null);
  const [choiceFormData, setChoiceFormData] = useState<ChoiceFormData>({
    id: '',
    label: '',
    description: '',
    skillRequired: 'diplomacy',
    skillLevel: 50,
    riskLevel: 'medium',
    effects: {},
    predictedOutcomes: {},
  });

  // Form state
  const [formData, setFormData] = useState<ScenarioFormData>({
    type: 'diplomatic_incident',
    title: '',
    narrative: '',
    relationshipState: 'neutral',
    relationshipStrength: 50,
    culturalImpact: 50,
    diplomaticRisk: 50,
    economicCost: 30,
    timeFrame: 'strategic',
    difficulty: 'moderate',
    status: 'active',
    country1Id: '',
    country2Id: '',
  });

  const [responseOptions, setResponseOptions] = useState<ChoiceFormData[]>([]);

  // Queries
  const { data: scenarios, isLoading, refetch } = api.diplomaticScenarios.getAllScenariosAdmin.useQuery(
    {
      includeInactive: showInactive,
      includeExpired: showInactive,
      type: typeFilter !== 'all' ? typeFilter as any : undefined,
      search: searchQuery || undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const createMutation = api.diplomaticScenarios.createScenario.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Scenario created successfully",
        type: "success"
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create scenario",
        type: "error"
      });
    }
  });

  const updateMutation = api.diplomaticScenarios.updateScenario.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Scenario updated successfully",
        type: "success"
      });
      refetch();
      setEditingScenario(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update scenario",
        type: "error"
      });
    }
  });

  const deleteMutation = api.diplomaticScenarios.deleteScenario.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Scenario deleted successfully",
        type: "success"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete scenario",
        type: "error"
      });
    }
  });

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];

    return scenarios.filter(scenario => {
      // Relationship filter
      if (relationshipFilter.length > 0 && !relationshipFilter.includes(scenario.relationshipState)) {
        return false;
      }

      // Difficulty filter (stored in tags)
      if (difficultyFilter.length > 0) {
        const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
        if (!difficultyFilter.some(d => tags.includes(d))) {
          return false;
        }
      }

      // Time frame filter (stored in tags)
      if (timeFrameFilter.length > 0) {
        const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
        if (!timeFrameFilter.some(t => tags.includes(t))) {
          return false;
        }
      }

      return true;
    });
  }, [scenarios, relationshipFilter, difficultyFilter, timeFrameFilter]);

  // Handlers
  const resetForm = () => {
    setFormData({
      type: 'diplomatic_incident',
      title: '',
      narrative: '',
      relationshipState: 'neutral',
      relationshipStrength: 50,
      culturalImpact: 50,
      diplomaticRisk: 50,
      economicCost: 30,
      timeFrame: 'strategic',
      difficulty: 'moderate',
      status: 'active',
      country1Id: '',
      country2Id: '',
    });
    setResponseOptions([]);
    setActiveTab('general');
  };

  const handleCreate = () => {
    if (!formData.title || !formData.narrative || !formData.country1Id || !formData.country2Id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        type: "error"
      });
      return;
    }

    const timeFrameData = TIME_FRAMES.find(t => t.value === formData.timeFrame);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (timeFrameData?.duration || 14));

    createMutation.mutate({
      type: formData.type,
      title: formData.title,
      narrative: formData.narrative,
      country1Id: formData.country1Id,
      country2Id: formData.country2Id,
      relationshipState: formData.relationshipState,
      relationshipStrength: formData.relationshipStrength,
      responseOptions: responseOptions,
      tags: [formData.type, formData.difficulty, formData.timeFrame],
      culturalImpact: formData.culturalImpact,
      diplomaticRisk: formData.diplomaticRisk,
      economicCost: formData.economicCost,
      expiresAt,
      status: formData.status as any,
    });
  };

  const handleUpdate = () => {
    if (!editingScenario?.id) return;

    const timeFrameData = TIME_FRAMES.find(t => t.value === formData.timeFrame);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (timeFrameData?.duration || 14));

    updateMutation.mutate({
      id: editingScenario.id,
      type: formData.type,
      title: formData.title,
      narrative: formData.narrative,
      relationshipState: formData.relationshipState,
      relationshipStrength: formData.relationshipStrength,
      responseOptions: responseOptions,
      tags: [formData.type, formData.difficulty, formData.timeFrame],
      culturalImpact: formData.culturalImpact,
      diplomaticRisk: formData.diplomaticRisk,
      economicCost: formData.economicCost,
      expiresAt,
      status: formData.status as any,
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (scenario: any) => {
    const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
    const difficulty = tags.find((t: string) => ['trivial', 'moderate', 'challenging', 'critical', 'legendary'].includes(t)) || 'moderate';
    const timeFrame = tags.find((t: string) => ['urgent', 'time_sensitive', 'strategic', 'long_term'].includes(t)) || 'strategic';

    setFormData({
      type: scenario.type,
      title: scenario.title,
      narrative: scenario.narrative,
      relationshipState: scenario.relationshipState,
      relationshipStrength: scenario.relationshipStrength,
      culturalImpact: scenario.culturalImpact,
      diplomaticRisk: scenario.diplomaticRisk,
      economicCost: scenario.economicCost,
      timeFrame,
      difficulty,
      status: scenario.status,
      country1Id: scenario.country1Id,
      country2Id: scenario.country2Id,
    });
    setResponseOptions(Array.isArray(scenario.responseOptions) ? scenario.responseOptions : []);
    setEditingScenario(scenario);
    setActiveTab('general');
  };

  const handleClone = (scenario: any) => {
    const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
    const difficulty = tags.find((t: string) => ['trivial', 'moderate', 'challenging', 'critical', 'legendary'].includes(t)) || 'moderate';
    const timeFrame = tags.find((t: string) => ['urgent', 'time_sensitive', 'strategic', 'long_term'].includes(t)) || 'strategic';

    setFormData({
      type: scenario.type,
      title: `${scenario.title} (Copy)`,
      narrative: scenario.narrative,
      relationshipState: scenario.relationshipState,
      relationshipStrength: scenario.relationshipStrength,
      culturalImpact: scenario.culturalImpact,
      diplomaticRisk: scenario.diplomaticRisk,
      economicCost: scenario.economicCost,
      timeFrame,
      difficulty,
      status: 'active',
      country1Id: scenario.country1Id,
      country2Id: scenario.country2Id,
    });
    setResponseOptions(Array.isArray(scenario.responseOptions) ? scenario.responseOptions.map((opt: any) => ({ ...opt, id: `${opt.id}_copy_${Date.now()}` })) : []);
    setIsAddDialogOpen(true);
    setActiveTab('general');
  };

  const handleBulkActivate = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one scenario",
        type: "warning"
      });
      return;
    }

    // Update each selected scenario to active
    Promise.all(
      Array.from(selectedIds).map(id =>
        updateMutation.mutateAsync({ id, status: 'active' })
      )
    ).then(() => {
      toast({
        title: "Success",
        description: `Activated ${selectedIds.size} scenarios`,
        type: "success"
      });
      setSelectedIds(new Set());
      refetch();
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to activate some scenarios",
        type: "error"
      });
    });
  };

  const handleBulkDeactivate = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one scenario",
        type: "warning"
      });
      return;
    }

    Promise.all(
      Array.from(selectedIds).map(id =>
        updateMutation.mutateAsync({ id, status: 'expired' })
      )
    ).then(() => {
      toast({
        title: "Success",
        description: `Deactivated ${selectedIds.size} scenarios`,
        type: "success"
      });
      setSelectedIds(new Set());
      refetch();
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to deactivate some scenarios",
        type: "error"
      });
    });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredScenarios.length && filteredScenarios.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredScenarios.map(s => s.id)));
    }
  };

  // Choice management handlers
  const handleAddChoice = () => {
    const newChoice: ChoiceFormData = {
      id: `choice_${Date.now()}`,
      label: '',
      description: '',
      skillRequired: 'diplomacy',
      skillLevel: 50,
      riskLevel: 'medium',
      effects: {},
      predictedOutcomes: {},
    };
    setChoiceFormData(newChoice);
    setEditingChoiceIndex(responseOptions.length);
  };

  const handleEditChoice = (index: number) => {
    setChoiceFormData(responseOptions[index]!);
    setEditingChoiceIndex(index);
  };

  const handleSaveChoice = () => {
    if (!choiceFormData.label) {
      toast({
        title: "Validation Error",
        description: "Choice label is required",
        type: "error"
      });
      return;
    }

    const newOptions = [...responseOptions];
    if (editingChoiceIndex !== null && editingChoiceIndex < responseOptions.length) {
      newOptions[editingChoiceIndex] = choiceFormData;
    } else {
      newOptions.push(choiceFormData);
    }
    setResponseOptions(newOptions);
    setEditingChoiceIndex(null);
    setChoiceFormData({
      id: '',
      label: '',
      description: '',
      skillRequired: 'diplomacy',
      skillLevel: 50,
      riskLevel: 'medium',
      effects: {},
      predictedOutcomes: {},
    });
  };

  const handleDeleteChoice = (index: number) => {
    if (confirm("Are you sure you want to delete this choice?")) {
      const newOptions = responseOptions.filter((_, i) => i !== index);
      setResponseOptions(newOptions);
    }
  };

  const handleCancelChoiceEdit = () => {
    setEditingChoiceIndex(null);
    setChoiceFormData({
      id: '',
      label: '',
      description: '',
      skillRequired: 'diplomacy',
      skillLevel: 50,
      riskLevel: 'medium',
      effects: {},
      predictedOutcomes: {},
    });
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole = typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass-card-parent p-6 rounded-xl border-2 border-red-500/20 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <Globe className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Diplomatic Scenarios
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage dynamic diplomatic scenarios and player choices
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-red-500/20 hover:bg-red-500/30 text-red-500">
              <Plus className="h-4 w-4 mr-2" />
              Add Scenario
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div className="md:col-span-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search scenarios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SCENARIO_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show inactive toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="showInactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
              />
              <label htmlFor="showInactive" className="text-sm text-foreground cursor-pointer">
                Show inactive/expired
              </label>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Relationship Level Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Relationship Levels</label>
              <div className="flex flex-wrap gap-2">
                {RELATIONSHIP_LEVELS.map(level => (
                  <div key={level.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`rel-${level.value}`}
                      checked={relationshipFilter.includes(level.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRelationshipFilter([...relationshipFilter, level.value]);
                        } else {
                          setRelationshipFilter(relationshipFilter.filter(r => r !== level.value));
                        }
                      }}
                    />
                    <label htmlFor={`rel-${level.value}`} className={`text-xs cursor-pointer ${level.color}`}>
                      {level.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Difficulty Levels</label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_LEVELS.map(difficulty => (
                  <div key={difficulty.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`diff-${difficulty.value}`}
                      checked={difficultyFilter.includes(difficulty.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setDifficultyFilter([...difficultyFilter, difficulty.value]);
                        } else {
                          setDifficultyFilter(difficultyFilter.filter(d => d !== difficulty.value));
                        }
                      }}
                    />
                    <label htmlFor={`diff-${difficulty.value}`} className={`text-xs cursor-pointer ${difficulty.color}`}>
                      {difficulty.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Frame Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Time Frames</label>
              <div className="flex flex-wrap gap-2">
                {TIME_FRAMES.map(frame => (
                  <div key={frame.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`time-${frame.value}`}
                      checked={timeFrameFilter.includes(frame.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setTimeFrameFilter([...timeFrameFilter, frame.value]);
                        } else {
                          setTimeFrameFilter(timeFrameFilter.filter(t => t !== frame.value));
                        }
                      }}
                    />
                    <label htmlFor={`time-${frame.value}`} className="text-xs cursor-pointer text-foreground">
                      {frame.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                <Check className="h-4 w-4 mr-2" />
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
                <X className="h-4 w-4 mr-2" />
                Deactivate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="glass-card-child p-4">
            <p className="text-sm text-muted-foreground">Total Scenarios</p>
            <p className="text-3xl font-bold text-foreground mt-2">{scenarios?.length || 0}</p>
          </Card>
          <Card className="glass-card-child p-4">
            <p className="text-sm text-muted-foreground">Active Scenarios</p>
            <p className="text-3xl font-bold text-green-400 mt-2">
              {scenarios?.filter(s => s.status === 'active').length || 0}
            </p>
          </Card>
          <Card className="glass-card-child p-4">
            <p className="text-sm text-muted-foreground">Filtered Results</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{filteredScenarios.length}</p>
          </Card>
          <Card className="glass-card-child p-4">
            <p className="text-sm text-muted-foreground">Scenario Types</p>
            <p className="text-3xl font-bold text-purple-400 mt-2">{SCENARIO_TYPES.length}</p>
          </Card>
        </div>

        {/* Scenarios Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading scenarios...</p>
          </div>
        ) : filteredScenarios.length === 0 ? (
          <Card className="glass-card-parent p-12 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No scenarios found matching your filters</p>
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Scenario
            </Button>
          </Card>
        ) : (
          <>
            {/* Select All Checkbox */}
            <div className="mb-4 flex items-center gap-2">
              <Checkbox
                id="selectAll"
                checked={selectedIds.size === filteredScenarios.length && filteredScenarios.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="selectAll" className="text-sm text-foreground cursor-pointer">
                Select all ({filteredScenarios.length} items)
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScenarios.map(scenario => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  isSelected={selectedIds.has(scenario.id)}
                  onToggleSelect={() => toggleSelection(scenario.id)}
                  onEdit={() => handleEdit(scenario)}
                  onClone={() => handleClone(scenario)}
                  onDelete={() => handleDelete(scenario.id, scenario.title)}
                />
              ))}
            </div>
          </>
        )}

        {/* Scenario Editor Dialog */}
        {(isAddDialogOpen || editingScenario) && (
          <ScenarioEditorDialog
            isOpen={isAddDialogOpen || !!editingScenario}
            isEditing={!!editingScenario}
            formData={formData}
            setFormData={setFormData}
            responseOptions={responseOptions}
            setResponseOptions={setResponseOptions}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            choiceFormData={choiceFormData}
            setChoiceFormData={setChoiceFormData}
            editingChoiceIndex={editingChoiceIndex}
            onAddChoice={handleAddChoice}
            onEditChoice={handleEditChoice}
            onSaveChoice={handleSaveChoice}
            onDeleteChoice={handleDeleteChoice}
            onCancelChoiceEdit={handleCancelChoiceEdit}
            onClose={() => {
              setIsAddDialogOpen(false);
              setEditingScenario(null);
              resetForm();
            }}
            onSave={editingScenario ? handleUpdate : handleCreate}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

// Scenario Card Component
interface ScenarioCardProps {
  scenario: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function ScenarioCard({ scenario, isSelected, onToggleSelect, onEdit, onClone, onDelete }: ScenarioCardProps) {
  const scenarioType = SCENARIO_TYPES.find(t => t.value === scenario.type);
  const Icon = scenarioType?.icon || Globe;
  const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
  const difficulty = tags.find((t: string) => ['trivial', 'moderate', 'challenging', 'critical', 'legendary'].includes(t)) || 'moderate';
  const timeFrame = tags.find((t: string) => ['urgent', 'time_sensitive', 'strategic', 'long_term'].includes(t)) || 'strategic';
  const choices = Array.isArray(scenario.responseOptions) ? scenario.responseOptions : [];

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-500/20',
    pending: 'text-yellow-400 bg-yellow-500/20',
    completed: 'text-blue-400 bg-blue-500/20',
    expired: 'text-red-400 bg-red-500/20',
    declined: 'text-gray-400 bg-gray-500/20',
  };

  const difficultyColors: Record<string, string> = {
    trivial: 'text-gray-400',
    moderate: 'text-blue-400',
    challenging: 'text-yellow-400',
    critical: 'text-orange-400',
    legendary: 'text-purple-400',
  };

  return (
    <Card className={`glass-card-child p-4 hover:border-red-500/50 transition-all ${isSelected ? 'ring-2 ring-red-500' : ''}`}>
      {/* Selection & Header */}
      <div className="flex items-start justify-between mb-3">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        <div className="flex-1 ml-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="h-4 w-4 text-red-400" />
            <h3 className="font-semibold text-foreground line-clamp-1 text-sm">{scenario.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[scenario.status] || 'bg-gray-500/20'}`}>
              {scenario.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
              {scenarioType?.label || scenario.type}
            </span>
          </div>
        </div>
      </div>

      {/* Scenario Info */}
      <div className="space-y-2 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Countries:</span>
          <span className="font-medium text-foreground text-right line-clamp-1">
            {scenario.country1Name} - {scenario.country2Name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Relationship:</span>
          <span className="font-medium text-foreground capitalize">{scenario.relationshipState}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Difficulty:</span>
          <span className={`font-medium capitalize ${difficultyColors[difficulty]}`}>{difficulty}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Time Frame:</span>
          <span className="font-medium text-foreground capitalize">{timeFrame.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Choices:</span>
          <span className="font-medium text-foreground">{choices.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Impact:</span>
          <span className="font-medium text-foreground">{Math.round(scenario.culturalImpact)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Risk:</span>
          <span className="font-medium text-foreground">{Math.round(scenario.diplomaticRisk)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/10">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 text-xs">
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onClone} className="text-xs">
          <Copy className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}

// Scenario Editor Dialog
interface ScenarioEditorDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ScenarioFormData;
  setFormData: (data: ScenarioFormData) => void;
  responseOptions: ChoiceFormData[];
  setResponseOptions: (options: ChoiceFormData[]) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  choiceFormData: ChoiceFormData;
  setChoiceFormData: (data: ChoiceFormData) => void;
  editingChoiceIndex: number | null;
  onAddChoice: () => void;
  onEditChoice: (index: number) => void;
  onSaveChoice: () => void;
  onDeleteChoice: (index: number) => void;
  onCancelChoiceEdit: () => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

function ScenarioEditorDialog({
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
  onAddChoice,
  onEditChoice,
  onSaveChoice,
  onDeleteChoice,
  onCancelChoiceEdit,
  onClose,
  onSave,
  isPending
}: ScenarioEditorDialogProps) {
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'narrative', label: 'Narrative', icon: FileText },
    { id: 'choices', label: 'Choices', icon: List },
    { id: 'metadata', label: 'Metadata', icon: Target },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Scenario' : 'Add Scenario'}
          </DialogTitle>
          <DialogDescription>
            Configure diplomatic scenario template with player choices
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2 shrink-0">
            {tabs.map(tab => {
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
          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="general">
              <GeneralTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="narrative">
              <NarrativeTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="choices">
              <ChoicesTab
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
        <DialogFooter className="border-t border-white/10 pt-4 shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.title || !formData.narrative || !formData.country1Id || !formData.country2Id || isPending}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-500"
          >
            {isPending ? "Saving..." : isEditing ? "Update Scenario" : "Create Scenario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tab Components
function GeneralTab({ formData, setFormData }: {
  formData: ScenarioFormData;
  setFormData: (data: ScenarioFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Scenario Type *</label>
        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENARIO_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Border Patrol Incident Escalates Tensions"
          maxLength={500}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Country 1 ID *</label>
          <Input
            value={formData.country1Id}
            onChange={(e) => setFormData({ ...formData, country1Id: e.target.value })}
            placeholder="Country ID (CUID)"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Country 2 ID *</label>
          <Input
            value={formData.country2Id}
            onChange={(e) => setFormData({ ...formData, country2Id: e.target.value })}
            placeholder="Country ID (CUID)"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Relationship Level</label>
          <Select value={formData.relationshipState} onValueChange={(value) => setFormData({ ...formData, relationshipState: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Relationship Strength: {formData.relationshipStrength}
          </label>
          <Input
            type="number"
            value={formData.relationshipStrength}
            onChange={(e) => setFormData({ ...formData, relationshipStrength: parseFloat(e.target.value) || 0 })}
            min={0}
            max={100}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Difficulty</label>
          <Select value={formData.difficulty} onValueChange={(value) => setFormData({ ...formData, difficulty: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Time Frame</label>
          <Select value={formData.timeFrame} onValueChange={(value) => setFormData({ ...formData, timeFrame: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FRAMES.map(frame => (
                <SelectItem key={frame.value} value={frame.value}>{frame.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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

function NarrativeTab({ formData, setFormData }: {
  formData: ScenarioFormData;
  setFormData: (data: ScenarioFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Narrative *</label>
        <Textarea
          value={formData.narrative}
          onChange={(e) => setFormData({ ...formData, narrative: e.target.value })}
          placeholder="Rich narrative describing the scenario (3-5 paragraphs)..."
          rows={15}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Provide context, situation, implications, and urgency. This will be displayed to players.
        </p>
      </div>
    </div>
  );
}

function ChoicesTab({
  responseOptions,
  choiceFormData,
  setChoiceFormData,
  editingChoiceIndex,
  onAddChoice,
  onEditChoice,
  onSaveChoice,
  onDeleteChoice,
  onCancelChoiceEdit,
}: {
  responseOptions: ChoiceFormData[];
  choiceFormData: ChoiceFormData;
  setChoiceFormData: (data: ChoiceFormData) => void;
  editingChoiceIndex: number | null;
  onAddChoice: () => void;
  onEditChoice: (index: number) => void;
  onSaveChoice: () => void;
  onDeleteChoice: (index: number) => void;
  onCancelChoiceEdit: () => void;
}) {
  const [effectsJson, setEffectsJson] = useState(JSON.stringify(choiceFormData.effects, null, 2));
  const [outcomesJson, setOutcomesJson] = useState(JSON.stringify(choiceFormData.predictedOutcomes, null, 2));

  return (
    <div className="space-y-4">
      {/* Choices List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-foreground">Response Choices ({responseOptions.length})</label>
          <Button size="sm" onClick={onAddChoice} className="bg-red-500/20 hover:bg-red-500/30 text-red-500">
            <Plus className="h-4 w-4 mr-2" />
            Add Choice
          </Button>
        </div>

        {responseOptions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
            <p className="text-sm text-muted-foreground">No choices added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {responseOptions.map((choice, index) => (
              <Card key={index} className="glass-card-child p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{choice.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        RISK_LEVELS.find(r => r.value === choice.riskLevel)?.color || 'text-gray-400'
                      } bg-white/5`}>
                        {choice.riskLevel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{choice.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Skill: {choice.skillRequired} ({choice.skillLevel})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button size="sm" variant="ghost" onClick={() => onEditChoice(index)} className="text-xs">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDeleteChoice(index)} className="text-xs text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Choice Editor */}
      {editingChoiceIndex !== null && (
        <Card className="glass-card-parent p-4 border-2 border-red-500/30">
          <h4 className="text-sm font-medium text-foreground mb-3">
            {editingChoiceIndex < responseOptions.length ? 'Edit Choice' : 'Add New Choice'}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Label *</label>
              <Input
                value={choiceFormData.label}
                onChange={(e) => setChoiceFormData({ ...choiceFormData, label: e.target.value })}
                placeholder="e.g., Diplomatic Negotiation"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Description *</label>
              <Textarea
                value={choiceFormData.description}
                onChange={(e) => setChoiceFormData({ ...choiceFormData, description: e.target.value })}
                placeholder="Detailed description of this choice and its approach..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Skill Required</label>
                <Input
                  value={choiceFormData.skillRequired}
                  onChange={(e) => setChoiceFormData({ ...choiceFormData, skillRequired: e.target.value })}
                  placeholder="diplomacy"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Skill Level</label>
                <Input
                  type="number"
                  value={choiceFormData.skillLevel}
                  onChange={(e) => setChoiceFormData({ ...choiceFormData, skillLevel: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Risk Level</label>
                <Select value={choiceFormData.riskLevel} onValueChange={(value) => setChoiceFormData({ ...choiceFormData, riskLevel: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Effects (JSON)</label>
              <Textarea
                value={effectsJson}
                onChange={(e) => {
                  setEffectsJson(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setChoiceFormData({ ...choiceFormData, effects: parsed });
                  } catch (e) {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder='{"relationshipChange": 10, "culturalImpact": 5}'
                rows={3}
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Predicted Outcomes (JSON)</label>
              <Textarea
                value={outcomesJson}
                onChange={(e) => {
                  setOutcomesJson(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setChoiceFormData({ ...choiceFormData, predictedOutcomes: parsed });
                  } catch (e) {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder='{"shortTerm": "Improved relations", "longTerm": "Trade agreement signed"}'
                rows={3}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" onClick={onSaveChoice} className="bg-red-500/20 hover:bg-red-500/30 text-red-500">
                <Check className="h-4 w-4 mr-2" />
                Save Choice
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelChoiceEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function MetadataTab({ formData, setFormData }: {
  formData: ScenarioFormData;
  setFormData: (data: ScenarioFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Cultural Impact: {formData.culturalImpact}
          </label>
          <Input
            type="number"
            value={formData.culturalImpact}
            onChange={(e) => setFormData({ ...formData, culturalImpact: parseFloat(e.target.value) || 0 })}
            min={0}
            max={100}
          />
          <p className="text-xs text-muted-foreground mt-1">0-100 scale</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Diplomatic Risk: {formData.diplomaticRisk}
          </label>
          <Input
            type="number"
            value={formData.diplomaticRisk}
            onChange={(e) => setFormData({ ...formData, diplomaticRisk: parseFloat(e.target.value) || 0 })}
            min={0}
            max={100}
          />
          <p className="text-xs text-muted-foreground mt-1">0-100 scale</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Economic Cost: {formData.economicCost}
          </label>
          <Input
            type="number"
            value={formData.economicCost}
            onChange={(e) => setFormData({ ...formData, economicCost: parseFloat(e.target.value) || 0 })}
            min={0}
            max={100}
          />
          <p className="text-xs text-muted-foreground mt-1">0-100 scale</p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <h4 className="text-sm font-medium text-foreground mb-2">Scenario Guidelines</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
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
