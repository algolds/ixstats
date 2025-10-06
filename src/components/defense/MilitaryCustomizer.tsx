// src/components/defense/MilitaryCustomizer.tsx
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '~/trpc/react';
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Shield,
  Users,
  Plane,
  Ship,
  Radio,
  Target,
  Zap,
  Star,
  TrendingUp,
  DollarSign,
  Award,
  Settings,
  Info,
  CheckCircle2,
  HelpCircle,
  Image,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Slider } from '~/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';
import { UnitManager } from './UnitManager';
import { AssetManager } from './AssetManager';

interface MilitaryCustomizerProps {
  countryId: string;
}

// Branch type configurations inspired by Caphiria structure
const BRANCH_CONFIGS = {
  army: {
    label: 'Army',
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    unitTypes: ['division', 'brigade', 'regiment', 'battalion'],
    assetTypes: ['vehicle', 'weapon_system', 'installation'],
    defaultName: 'National Army',
  },
  navy: {
    label: 'Navy',
    icon: Ship,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    unitTypes: ['fleet', 'squadron', 'division'],
    assetTypes: ['ship', 'installation'],
    defaultName: 'Naval Forces',
  },
  air_force: {
    label: 'Air Force',
    icon: Plane,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    unitTypes: ['wing', 'squadron', 'group'],
    assetTypes: ['aircraft', 'installation'],
    defaultName: 'Air Force',
  },
  space_force: {
    label: 'Space Force',
    icon: Zap,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    unitTypes: ['squadron', 'delta', 'garrison'],
    assetTypes: ['installation', 'weapon_system'],
    defaultName: 'Space Command',
  },
  marines: {
    label: 'Marine Corps',
    icon: Target,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    unitTypes: ['division', 'regiment', 'battalion'],
    assetTypes: ['vehicle', 'aircraft', 'ship'],
    defaultName: 'Marine Corps',
  },
  cyber_command: {
    label: 'Cyber Command',
    icon: Radio,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    unitTypes: ['group', 'squadron', 'team'],
    assetTypes: ['installation', 'weapon_system'],
    defaultName: 'Cyber Command',
  },
  special_forces: {
    label: 'Special Operations',
    icon: Star,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    unitTypes: ['regiment', 'battalion', 'squadron'],
    assetTypes: ['weapon_system', 'vehicle', 'aircraft'],
    defaultName: 'Special Operations Command',
  },
  coast_guard: {
    label: 'Coast Guard',
    icon: Ship,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    unitTypes: ['district', 'sector', 'station'],
    assetTypes: ['ship', 'aircraft', 'installation'],
    defaultName: 'Coast Guard',
  },
} as const;

export function MilitaryCustomizer({ countryId }: MilitaryCustomizerProps) {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  // Fetch military branches
  const { data: branches, refetch: refetchBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Create branch mutation
  const createBranch = api.security.createMilitaryBranch.useMutation({
    onSuccess: () => {
      toast.success('Military branch created successfully');
      setShowBranchDialog(false);
      setEditingBranch(null);
      refetchBranches();
    },
    onError: (error) => {
      toast.error(`Failed to create branch: ${error.message}`);
    },
  });

  // Update branch mutation
  const updateBranch = api.security.updateMilitaryBranch.useMutation({
    onSuccess: () => {
      toast.success('Branch updated successfully');
      setShowBranchDialog(false);
      setEditingBranch(null);
      refetchBranches();
    },
    onError: (error) => {
      toast.error(`Failed to update branch: ${error.message}`);
    },
  });

  // Delete branch mutation
  const deleteBranch = api.security.deleteMilitaryBranch.useMutation({
    onSuccess: () => {
      toast.success('Branch deleted successfully');
      refetchBranches();
    },
    onError: (error) => {
      toast.error(`Failed to delete branch: ${error.message}`);
    },
  });

  const toggleBranch = (branchId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };

  const handleCreateBranch = () => {
    setEditingBranch(null);
    setShowBranchDialog(true);
  };

  const handleEditBranch = (branch: any) => {
    setEditingBranch(branch);
    setShowBranchDialog(true);
  };

  const handleDeleteBranch = (branchId: string) => {
    if (confirm('Are you sure you want to delete this military branch?')) {
      deleteBranch.mutate({ id: branchId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Military Forces Management
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-blue-600" />
                        Military Forces Management Guide
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-semibold mb-2">Creating Military Branches</h4>
                        <p className="text-muted-foreground">
                          Build your armed forces by creating branches (Army, Navy, Air Force, etc.). Each branch can have custom names, mottos, and organizational structures inspired by real-world militaries.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Branch Configuration</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li><strong>Personnel:</strong> Set active duty, reserve, and civilian staff numbers</li>
                          <li><strong>Budget:</strong> Allocate annual budget and percentage of total defense spending</li>
                          <li><strong>Readiness:</strong> Configure combat readiness, technology level, training, and morale</li>
                          <li><strong>Image/Emblem:</strong> Add custom branch insignia or emblems via image URL</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Units & Assets</h4>
                        <p className="text-muted-foreground">
                          Each branch can contain multiple units (divisions, regiments, squadrons) and assets (vehicles, aircraft, ships, weapon systems). Browse the equipment database to add assets from real-world systems.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Best Practices</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Keep budget allocations realistic (total should equal 100% of branch budget)</li>
                          <li>Balance readiness metrics - overly high values may not be sustainable</li>
                          <li>Use established dates to track branch history and traditions</li>
                          <li>Organize units hierarchically (e.g., Division → Brigade → Battalion)</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                Build and customize your armed forces with branches, units, and assets
              </CardDescription>
            </div>
            <Button onClick={handleCreateBranch}>
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Military Branches List */}
      {branches && branches.length > 0 ? (
        <div className="space-y-4">
          {branches.map((branch) => {
            const config = BRANCH_CONFIGS[branch.branchType as keyof typeof BRANCH_CONFIGS];
            const Icon = config?.icon ?? Shield;
            const isExpanded = expandedBranches.has(branch.id);

            return (
              <Card key={branch.id} className="glass-hierarchy-child border-2 border-border">
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toggleBranch(branch.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-muted border border-border relative overflow-hidden">
                        {branch.imageUrl && (
                          <div
                            className="absolute inset-0 bg-cover bg-center opacity-30"
                            style={{ backgroundImage: `url(${branch.imageUrl})` }}
                          />
                        )}
                        <Icon className={cn('h-6 w-6 relative z-10', config?.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{branch.name}</h3>
                          <Badge variant="outline">{config?.label ?? branch.branchType}</Badge>
                        </div>
                        {branch.motto && (
                          <p className="text-sm text-muted-foreground italic">"{branch.motto}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditBranch(branch);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBranch(branch.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CardContent className="pt-6 space-y-6">
                        {/* Personnel Stats */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 rounded-lg bg-muted/50">
                            <Users className="h-5 w-5 mx-auto mb-2 text-blue-600" />
                            <div className="text-2xl font-bold">
                              <NumberFlowDisplay value={branch.activeDuty} />
                            </div>
                            <div className="text-xs text-muted-foreground">Active Duty</div>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-muted/50">
                            <Users className="h-5 w-5 mx-auto mb-2 text-green-600" />
                            <div className="text-2xl font-bold">
                              <NumberFlowDisplay value={branch.reserves} />
                            </div>
                            <div className="text-xs text-muted-foreground">Reserves</div>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-muted/50">
                            <Users className="h-5 w-5 mx-auto mb-2 text-purple-600" />
                            <div className="text-2xl font-bold">
                              <NumberFlowDisplay value={branch.civilianStaff} />
                            </div>
                            <div className="text-xs text-muted-foreground">Civilian Staff</div>
                          </div>
                        </div>

                        <Separator />

                        {/* Readiness Metrics */}
                        <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Readiness & Capability
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Readiness Level</span>
                                <span className="font-medium">
                                  <NumberFlowDisplay value={branch.readinessLevel} format="percentage" decimalPlaces={0} />
                                </span>
                              </div>
                              <Progress value={branch.readinessLevel} className="h-2" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Technology</span>
                                <span className="font-medium">
                                  <NumberFlowDisplay value={branch.technologyLevel} format="percentage" decimalPlaces={0} />
                                </span>
                              </div>
                              <Progress value={branch.technologyLevel} className="h-2" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Training</span>
                                <span className="font-medium">
                                  <NumberFlowDisplay value={branch.trainingLevel} format="percentage" decimalPlaces={0} />
                                </span>
                              </div>
                              <Progress value={branch.trainingLevel} className="h-2" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Morale</span>
                                <span className="font-medium">
                                  <NumberFlowDisplay value={branch.morale} format="percentage" decimalPlaces={0} />
                                </span>
                              </div>
                              <Progress value={branch.morale} className="h-2" />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Budget */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <span className="font-medium">Annual Budget</span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              $<NumberFlowDisplay value={branch.annualBudget} format="compact" />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <NumberFlowDisplay value={branch.budgetPercent} format="percentage" decimalPlaces={1} /> of defense budget
                            </div>
                          </div>
                        </div>

                        {/* Units & Assets Managers */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-4 rounded-lg border bg-card">
                            <UnitManager
                              branchId={branch.id}
                              branchType={branch.branchType}
                              units={branch.units ?? []}
                              onRefetch={refetchBranches}
                            />
                          </div>
                          <div className="p-4 rounded-lg border bg-card">
                            <AssetManager
                              branchId={branch.id}
                              branchType={branch.branchType}
                              assets={branch.assets ?? []}
                              onRefetch={refetchBranches}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-hierarchy-child">
          <CardContent className="py-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Military Branches</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first military branch to start building your armed forces
            </p>
            <Button onClick={handleCreateBranch}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Branch
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Branch Creation/Edit Dialog */}
      <BranchDialog
        open={showBranchDialog}
        onOpenChange={setShowBranchDialog}
        branch={editingBranch}
        countryId={countryId}
        onCreate={(data) => createBranch.mutate({ countryId, branch: data })}
        onUpdate={(id, data) => updateBranch.mutate({ id, branch: data })}
      />
    </div>
  );
}

// Branch Dialog Component
interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: any | null;
  countryId: string;
  onCreate: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
}

function BranchDialog({ open, onOpenChange, branch, countryId, onCreate, onUpdate }: BranchDialogProps) {
  const [formData, setFormData] = useState({
    branchType: branch?.branchType ?? 'army',
    name: branch?.name ?? '',
    description: branch?.description ?? '',
    motto: branch?.motto ?? '',
    established: branch?.established ?? '',
    imageUrl: branch?.imageUrl ?? '',
    activeDuty: branch?.activeDuty ?? 0,
    reserves: branch?.reserves ?? 0,
    civilianStaff: branch?.civilianStaff ?? 0,
    annualBudget: branch?.annualBudget ?? 0,
    budgetPercent: branch?.budgetPercent ?? 0,
    readinessLevel: branch?.readinessLevel ?? 50,
    technologyLevel: branch?.technologyLevel ?? 50,
    trainingLevel: branch?.trainingLevel ?? 50,
    morale: branch?.morale ?? 50,
    deploymentCapacity: branch?.deploymentCapacity ?? 50,
    sustainmentCapacity: branch?.sustainmentCapacity ?? 50,
  });

  React.useEffect(() => {
    if (branch) {
      setFormData({
        branchType: branch.branchType,
        name: branch.name,
        description: branch.description ?? '',
        motto: branch.motto ?? '',
        established: branch.established ?? '',
        imageUrl: branch.imageUrl ?? '',
        activeDuty: branch.activeDuty,
        reserves: branch.reserves,
        civilianStaff: branch.civilianStaff,
        annualBudget: branch.annualBudget,
        budgetPercent: branch.budgetPercent,
        readinessLevel: branch.readinessLevel,
        technologyLevel: branch.technologyLevel,
        trainingLevel: branch.trainingLevel,
        morale: branch.morale,
        deploymentCapacity: branch.deploymentCapacity,
        sustainmentCapacity: branch.sustainmentCapacity,
      });
    } else {
      const config = BRANCH_CONFIGS[formData.branchType as keyof typeof BRANCH_CONFIGS];
      setFormData((prev) => ({ ...prev, name: config?.defaultName ?? '' }));
    }
  }, [branch, open]);

  const handleSubmit = () => {
    if (branch) {
      onUpdate(branch.id, formData);
    } else {
      onCreate(formData);
    }
  };

  const config = BRANCH_CONFIGS[formData.branchType as keyof typeof BRANCH_CONFIGS];
  const Icon = config?.icon ?? Shield;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', config?.color)} />
            {branch ? 'Edit Military Branch' : 'Create Military Branch'}
          </DialogTitle>
          <DialogDescription>
            Configure your military branch with personnel, budget, and readiness metrics
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="personnel">Personnel & Budget</TabsTrigger>
            <TabsTrigger value="readiness">Readiness & Capability</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label>Branch Type</Label>
              <Select
                value={formData.branchType}
                onValueChange={(value) => {
                  const config = BRANCH_CONFIGS[value as keyof typeof BRANCH_CONFIGS];
                  setFormData({ ...formData, branchType: value, name: config?.defaultName ?? '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BRANCH_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className={cn('h-4 w-4', config.color)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Imperial Legion, Royal Navy"
              />
            </div>

            <div className="space-y-2">
              <Label>Motto (Optional)</Label>
              <Input
                value={formData.motto}
                onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                placeholder="e.g., Always Ready, Always There"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this military branch..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Established (Optional)</Label>
              <Input
                value={formData.established}
                onChange={(e) => setFormData({ ...formData, established: e.target.value })}
                placeholder="e.g., 1775, March 2000"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Branch Emblem/Image URL (Optional)
              </Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/branch-emblem.png"
              />
              {formData.imageUrl && (
                <div className="mt-2 p-2 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <div className="w-16 h-16 rounded-lg overflow-hidden border">
                    <img
                      src={formData.imageUrl}
                      alt="Branch emblem preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                        e.currentTarget.alt = 'Invalid image URL';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="personnel" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Active Duty Personnel</Label>
                <Input
                  type="number"
                  value={formData.activeDuty}
                  onChange={(e) => setFormData({ ...formData, activeDuty: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reserve Personnel</Label>
                <Input
                  type="number"
                  value={formData.reserves}
                  onChange={(e) => setFormData({ ...formData, reserves: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Civilian Staff</Label>
                <Input
                  type="number"
                  value={formData.civilianStaff}
                  onChange={(e) => setFormData({ ...formData, civilianStaff: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Annual Budget ($)</Label>
                <Input
                  type="number"
                  value={formData.annualBudget}
                  onChange={(e) => setFormData({ ...formData, annualBudget: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Budget % of Total Defense</Label>
                <Input
                  type="number"
                  value={formData.budgetPercent}
                  onChange={(e) => setFormData({ ...formData, budgetPercent: parseFloat(e.target.value) || 0 })}
                  max={100}
                  min={0}
                  step={0.1}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="readiness" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Readiness Level</Label>
                  <span className="text-sm font-medium">{formData.readinessLevel}%</span>
                </div>
                <Slider
                  value={[formData.readinessLevel]}
                  onValueChange={([value]) => setFormData({ ...formData, readinessLevel: value })}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Technology Level</Label>
                  <span className="text-sm font-medium">{formData.technologyLevel}%</span>
                </div>
                <Slider
                  value={[formData.technologyLevel]}
                  onValueChange={([value]) => setFormData({ ...formData, technologyLevel: value })}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Training Level</Label>
                  <span className="text-sm font-medium">{formData.trainingLevel}%</span>
                </div>
                <Slider
                  value={[formData.trainingLevel]}
                  onValueChange={([value]) => setFormData({ ...formData, trainingLevel: value })}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Morale</Label>
                  <span className="text-sm font-medium">{formData.morale}%</span>
                </div>
                <Slider
                  value={[formData.morale]}
                  onValueChange={([value]) => setFormData({ ...formData, morale: value })}
                  max={100}
                  step={1}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Deployment Capacity</Label>
                  <span className="text-sm font-medium">{formData.deploymentCapacity}%</span>
                </div>
                <Slider
                  value={[formData.deploymentCapacity]}
                  onValueChange={([value]) => setFormData({ ...formData, deploymentCapacity: value })}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sustainment Capacity</Label>
                  <span className="text-sm font-medium">{formData.sustainmentCapacity}%</span>
                </div>
                <Slider
                  value={[formData.sustainmentCapacity]}
                  onValueChange={([value]) => setFormData({ ...formData, sustainmentCapacity: value })}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {branch ? 'Update Branch' : 'Create Branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}