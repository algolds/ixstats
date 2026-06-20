// src/components/defense/military/BranchDialog.tsx
"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Image, Shield } from "lucide-react";
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
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { BRANCH_CONFIGS } from "~/lib/military-config";

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: any | null;
  countryId: string;
  onCreate: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
}

/** Dialog for creating or editing a military branch with tabbed form sections. */
export function BranchDialog({
  open,
  onOpenChange,
  branch,
  countryId,
  onCreate,
  onUpdate,
}: BranchDialogProps) {
  const [formData, setFormData] = useState({
    branchType: branch?.branchType ?? "army",
    name: branch?.name ?? "",
    description: branch?.description ?? "",
    motto: branch?.motto ?? "",
    established: branch?.established ?? "",
    imageUrl: branch?.imageUrl ?? "",
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

  useEffect(() => {
    if (branch) {
      setFormData({
        branchType: branch.branchType,
        name: branch.name,
        description: branch.description ?? "",
        motto: branch.motto ?? "",
        established: branch.established ?? "",
        imageUrl: branch.imageUrl ?? "",
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
      setFormData((prev) => ({ ...prev, name: config?.defaultName ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", config?.color)} />
            {branch ? "Edit Military Branch" : "Create Military Branch"}
          </DialogTitle>
          <DialogDescription>
            Configure your military branch with personnel, budget, and readiness metrics
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="personnel">Personnel &amp; Budget</TabsTrigger>
            <TabsTrigger value="readiness">Readiness &amp; Capability</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label>Branch Type</Label>
              <Select
                value={formData.branchType}
                onValueChange={(value) => {
                  const cfg = BRANCH_CONFIGS[value as keyof typeof BRANCH_CONFIGS];
                  setFormData({ ...formData, branchType: value, name: cfg?.defaultName ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BRANCH_CONFIGS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <cfg.icon className={cn("h-4 w-4", cfg.color)} />
                        {cfg.label}
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
                <div className="mt-2 rounded-lg border p-2">
                  <p className="text-muted-foreground mb-2 text-xs">Preview:</p>
                  <div className="h-16 w-16 overflow-hidden rounded-lg border">
                    <img
                      src={formData.imageUrl}
                      alt="Branch emblem preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                        e.currentTarget.alt = "Invalid image URL";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="personnel" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Active Duty Personnel</Label>
                <Input
                  type="number"
                  value={formData.activeDuty}
                  onChange={(e) =>
                    setFormData({ ...formData, activeDuty: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Reserve Personnel</Label>
                <Input
                  type="number"
                  value={formData.reserves}
                  onChange={(e) =>
                    setFormData({ ...formData, reserves: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Civilian Staff</Label>
                <Input
                  type="number"
                  value={formData.civilianStaff}
                  onChange={(e) =>
                    setFormData({ ...formData, civilianStaff: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Annual Budget ($)</Label>
                <Input
                  type="number"
                  value={formData.annualBudget}
                  onChange={(e) =>
                    setFormData({ ...formData, annualBudget: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Budget % of Total Defense</Label>
                <Input
                  type="number"
                  value={formData.budgetPercent}
                  onChange={(e) =>
                    setFormData({ ...formData, budgetPercent: parseFloat(e.target.value) || 0 })
                  }
                  max={100}
                  min={0}
                  step={0.1}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="readiness" className="space-y-4">
            <div className="space-y-4">
              <SliderField
                label="Readiness Level"
                value={formData.readinessLevel}
                onChange={(v) => setFormData({ ...formData, readinessLevel: v })}
              />
              <SliderField
                label="Technology Level"
                value={formData.technologyLevel}
                onChange={(v) => setFormData({ ...formData, technologyLevel: v })}
              />
              <SliderField
                label="Training Level"
                value={formData.trainingLevel}
                onChange={(v) => setFormData({ ...formData, trainingLevel: v })}
              />
              <SliderField
                label="Morale"
                value={formData.morale}
                onChange={(v) => setFormData({ ...formData, morale: v })}
              />

              <Separator />

              <SliderField
                label="Deployment Capacity"
                value={formData.deploymentCapacity}
                onChange={(v) => setFormData({ ...formData, deploymentCapacity: v })}
              />
              <SliderField
                label="Sustainment Capacity"
                value={formData.sustainmentCapacity}
                onChange={(v) => setFormData({ ...formData, sustainmentCapacity: v })}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {branch ? "Update Branch" : "Create Branch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reusable slider row used in the readiness tab */
function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-medium">{value}%</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} max={100} step={1} />
    </div>
  );
}
