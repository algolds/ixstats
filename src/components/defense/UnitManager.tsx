// src/components/defense/UnitManager.tsx
"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '~/trpc/react';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  MapPin,
  Shield,
  Star,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Slider } from '~/components/ui/slider';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { toast } from 'sonner';
import { UNIT_TEMPLATES } from '~/lib/military-equipment';
import { InlineHelpIcon } from '~/components/ui/help-icon';

interface UnitManagerProps {
  branchId: string;
  branchType: string;
  units: any[];
  onRefetch: () => void;
}

const UNIT_TYPES = {
  army: ['division', 'brigade', 'regiment', 'battalion'],
  navy: ['fleet', 'squadron', 'division'],
  air_force: ['wing', 'squadron', 'group'],
  marines: ['division', 'regiment', 'battalion'],
  space_force: ['squadron', 'delta', 'garrison'],
  cyber_command: ['group', 'squadron', 'team'],
  special_forces: ['regiment', 'battalion', 'squadron'],
  coast_guard: ['district', 'sector', 'station'],
} as const;

const SPECIALIZATIONS = {
  army: ['infantry', 'armor', 'artillery', 'airborne', 'special_ops', 'engineer'],
  navy: ['surface_warfare', 'submarine', 'aviation', 'amphibious', 'special_warfare'],
  air_force: ['fighter', 'bomber', 'transport', 'reconnaissance', 'special_ops'],
  marines: ['infantry', 'aviation', 'logistics', 'reconnaissance'],
  space_force: ['satellite_ops', 'missile_warning', 'space_control'],
  cyber_command: ['offensive', 'defensive', 'intelligence', 'electronic_warfare'],
  special_forces: ['direct_action', 'special_reconnaissance', 'unconventional_warfare'],
  coast_guard: ['law_enforcement', 'search_rescue', 'maritime_security'],
} as const;

const DEPLOYMENT_STATUS_CONFIG = {
  garrison: { label: 'Garrison', color: 'bg-gray-500' },
  training: { label: 'Training', color: 'bg-blue-500' },
  deployed: { label: 'Deployed', color: 'bg-yellow-500' },
  combat: { label: 'Combat', color: 'bg-red-500' },
  reserve: { label: 'Reserve', color: 'bg-green-500' },
} as const;

export function UnitManager({ branchId, branchType, units, onRefetch }: UnitManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  const createUnit = api.security.createMilitaryUnit.useMutation({
    onSuccess: () => {
      toast.success('Unit created successfully');
      setShowDialog(false);
      setEditingUnit(null);
      onRefetch();
    },
    onError: (error) => {
      toast.error(`Failed to create unit: ${error.message}`);
    },
  });

  const updateUnit = api.security.updateMilitaryUnit.useMutation({
    onSuccess: () => {
      toast.success('Unit updated successfully');
      setShowDialog(false);
      setEditingUnit(null);
      onRefetch();
    },
    onError: (error) => {
      toast.error(`Failed to update unit: ${error.message}`);
    },
  });

  const deleteUnit = api.security.deleteMilitaryUnit.useMutation({
    onSuccess: () => {
      toast.success('Unit deleted successfully');
      onRefetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete unit: ${error.message}`);
    },
  });

  const handleCreate = () => {
    setEditingUnit(null);
    setShowDialog(true);
  };

  const handleEdit = (unit: any) => {
    setEditingUnit(unit);
    setShowDialog(true);
  };

  const handleDelete = (unitId: string) => {
    if (confirm('Are you sure you want to delete this unit?')) {
      deleteUnit.mutate({ id: unitId });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Units ({units.length})
          <InlineHelpIcon
            title="Military Units"
            content="Manage your military units including divisions, brigades, regiments, and specialized formations. Each unit can be assigned personnel, equipment, and deployment status."
          />
        </h4>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-3 w-3 mr-1" />
          Add Unit
        </Button>
      </div>

      {units.length > 0 ? (
        <div className="space-y-2">
          {units.map((unit) => (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-medium text-sm">{unit.name}</h5>
                    <Badge variant="outline" className="text-xs">
                      {unit.unitType}
                    </Badge>
                    {unit.specialization && (
                      <Badge variant="secondary" className="text-xs">
                        {unit.specialization.replace('_', ' ')}
                      </Badge>
                    )}
                    <Badge className={DEPLOYMENT_STATUS_CONFIG[unit.deploymentStatus as keyof typeof DEPLOYMENT_STATUS_CONFIG]?.color}>
                      {DEPLOYMENT_STATUS_CONFIG[unit.deploymentStatus as keyof typeof DEPLOYMENT_STATUS_CONFIG]?.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span><NumberFlowDisplay value={unit.personnel} /> personnel</span>
                    </div>
                    {unit.homeBase && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{unit.homeBase}</span>
                      </div>
                    )}
                    {unit.commanderName && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        <span>{unit.commanderRank} {unit.commanderName}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Readiness</span>
                        <span className="font-medium">{unit.readiness}%</span>
                      </div>
                      <Progress value={unit.readiness} className="h-1" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Effectiveness</span>
                        <span className="font-medium">{unit.effectiveness}%</span>
                      </div>
                      <Progress value={unit.effectiveness} className="h-1" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(unit)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(unit.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
          No units yet. Create your first unit to get started.
        </div>
      )}

      <UnitDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        unit={editingUnit}
        branchId={branchId}
        branchType={branchType}
        onCreate={(data) => createUnit.mutate({ branchId, unit: data })}
        onUpdate={(id, data) => updateUnit.mutate({ id, unit: data })}
      />
    </div>
  );
}

interface UnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: any | null;
  branchId: string;
  branchType: string;
  onCreate: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
}

function UnitDialog({ open, onOpenChange, unit, branchId, branchType, onCreate, onUpdate }: UnitDialogProps) {
  const [formData, setFormData] = useState({
    name: unit?.name ?? '',
    unitType: unit?.unitType ?? 'division',
    specialization: unit?.specialization ?? '',
    personnel: unit?.personnel ?? 0,
    commanderName: unit?.commanderName ?? '',
    commanderRank: unit?.commanderRank ?? '',
    homeBase: unit?.homeBase ?? '',
    currentLocation: unit?.currentLocation ?? '',
    deploymentStatus: unit?.deploymentStatus ?? 'garrison',
    readiness: unit?.readiness ?? 50,
    effectiveness: unit?.effectiveness ?? 50,
  });

  React.useEffect(() => {
    if (unit) {
      setFormData(unit);
    } else {
      setFormData({
        name: '',
        unitType: 'division',
        specialization: '',
        personnel: 0,
        commanderName: '',
        commanderRank: '',
        homeBase: '',
        currentLocation: '',
        deploymentStatus: 'garrison',
        readiness: 50,
        effectiveness: 50,
      });
    }
  }, [unit, open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Unit name is required');
      return;
    }

    if (unit) {
      onUpdate(unit.id, formData);
    } else {
      onCreate(formData);
    }
  };

  // Get templates for this branch type
  const templates = Object.values(UNIT_TEMPLATES).filter(
    (t) => t.branch === branchType
  );

  const loadTemplate = (template: any) => {
    setFormData({
      ...formData,
      name: template.name,
      unitType: template.type,
      personnel: template.personnel,
    });
    toast.success('Template loaded');
  };

  const unitTypes = UNIT_TYPES[branchType as keyof typeof UNIT_TYPES] ?? ['division'];
  const specializations = SPECIALIZATIONS[branchType as keyof typeof SPECIALIZATIONS] ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{unit ? 'Edit Unit' : 'Create New Unit'}</DialogTitle>
          <DialogDescription>
            Configure unit details, personnel, and readiness levels
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Templates */}
          {!unit && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Quick Start Templates</Label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.name}
                    size="sm"
                    variant="outline"
                    onClick={() => loadTemplate(template)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 1st Infantry Division"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Type</Label>
              <Select value={formData.unitType} onValueChange={(value) => setFormData({ ...formData, unitType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Specialization & Personnel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Specialization (Optional)</Label>
              <Select
                value={formData.specialization}
                onValueChange={(value) => setFormData({ ...formData, specialization: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialization" />
                </SelectTrigger>
                <SelectContent>
                  {specializations.map((spec) => (
                    <SelectItem key={spec} value={spec}>
                      {spec.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Personnel</Label>
              <Input
                type="number"
                value={formData.personnel}
                onChange={(e) => setFormData({ ...formData, personnel: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Commander */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Commander Name (Optional)</Label>
              <Input
                value={formData.commanderName}
                onChange={(e) => setFormData({ ...formData, commanderName: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Commander Rank (Optional)</Label>
              <Input
                value={formData.commanderRank}
                onChange={(e) => setFormData({ ...formData, commanderRank: e.target.value })}
                placeholder="e.g., Major General"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Home Base (Optional)</Label>
              <Input
                value={formData.homeBase}
                onChange={(e) => setFormData({ ...formData, homeBase: e.target.value })}
                placeholder="e.g., Fort Bragg"
              />
            </div>
            <div className="space-y-2">
              <Label>Current Location (Optional)</Label>
              <Input
                value={formData.currentLocation}
                onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                placeholder="e.g., Training Area"
              />
            </div>
          </div>

          {/* Deployment Status */}
          <div className="space-y-2">
            <Label>Deployment Status</Label>
            <Select
              value={formData.deploymentStatus}
              onValueChange={(value) => setFormData({ ...formData, deploymentStatus: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DEPLOYMENT_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Readiness Metrics */}
          <div className="space-y-4 p-4 rounded-lg border">
            <h4 className="font-medium text-sm">Readiness Metrics</h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Readiness Level</Label>
                <span className="text-sm font-medium">{formData.readiness}%</span>
              </div>
              <Slider
                value={[formData.readiness]}
                onValueChange={([value]) => setFormData({ ...formData, readiness: value })}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Combat Effectiveness</Label>
                <span className="text-sm font-medium">{formData.effectiveness}%</span>
              </div>
              <Slider
                value={[formData.effectiveness]}
                onValueChange={([value]) => setFormData({ ...formData, effectiveness: value })}
                max={100}
                step={1}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {unit ? 'Update Unit' : 'Create Unit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
