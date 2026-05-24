"use client";

import { useState } from "react";
import { Crosshair, Shield, Anchor, Swords, GraduationCap, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useLocalActions } from "~/hooks/useLocalActions";

interface DeploymentWizardProps {
  countryId: string;
  onSuccess?: () => void;
}

const OP_TYPES = [
  {
    value: "peacekeeping",
    label: "Peacekeeping",
    icon: Shield,
    description: "Stabilize a region, improve relations",
  },
  {
    value: "defense_pact",
    label: "Defense Pact",
    icon: Crosshair,
    description: "Deploy forces to defend an ally",
  },
  {
    value: "blockade",
    label: "Naval Blockade",
    icon: Anchor,
    description: "Block enemy ports, high cost",
  },
  {
    value: "intervention",
    label: "Military Intervention",
    icon: Swords,
    description: "Direct military action",
  },
  {
    value: "training",
    label: "Training Exercise",
    icon: GraduationCap,
    description: "Improve readiness",
  },
] as const;

export function DeploymentWizard({ countryId, onSuccess }: DeploymentWizardProps) {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [operationType, setOperationType] = useState<string>("peacekeeping");
  const [description, setDescription] = useState("");
  const [targetCountryId, setTargetCountryId] = useState("");
  const [personnel, setPersonnel] = useState(1000);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: open }
  );

  const { data: relationships } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: open }
  );

  const { saveAction } = useLocalActions(countryId);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTargetCountryId("");
    setPersonnel(1000);
    setSelectedUnitIds([]);
    setSelectedAssetIds([]);
  };

  const handleDeploy = () => {
    const targetName =
      targetCountries.find((c) => c.id === targetCountryId)?.name ?? targetCountryId;
    saveAction("deployment", {
      name,
      operationType,
      description: description || undefined,
      targetCountryId: targetCountryId || undefined,
      targetCountryName: targetName || undefined,
      personnelDeployed: personnel,
      unitIds: selectedUnitIds,
      assetIds: selectedAssetIds,
      estimatedDailyCost,
      estimatedAnnualCost,
    });
    notify.success("Operation launched!", `${name} deployed successfully`);
    setOpen(false);
    resetForm();
    onSuccess?.();
  };

  // Flatten units and assets from branches
  const allUnits = branches?.flatMap((b) => b.units ?? []) ?? [];
  const allAssets = branches?.flatMap((b) => b.assets ?? []) ?? [];

  const targetCountries = relationships
    ? [
        ...new Map(
          relationships.map((r) => [
            r.targetCountryId,
            { id: r.targetCountryId, name: r.targetCountry ?? r.targetCountryId },
          ])
        ).values(),
      ]
    : [];

  // Cost estimate
  const estimatedDailyCost = personnel * 200;
  const estimatedAnnualCost = estimatedDailyCost * 365;

  const toggleUnit = (id: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
          Deploy Forces
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deploy Military Forces</DialogTitle>
          <DialogDescription>
            Create a military operation and assign units and assets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Operation name and type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operation Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Operation Iron Shield"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="h-4 w-4" />
                        <span>{t.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target and description */}
          <div>
            <Label>Target Nation (optional)</Label>
            <Select value={targetCountryId} onValueChange={setTargetCountryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent>
                {targetCountries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the operation objectives..."
              rows={2}
            />
          </div>

          {/* Personnel */}
          <div>
            <Label>Personnel Deployed: {personnel.toLocaleString()}</Label>
            <Slider
              value={[personnel]}
              onValueChange={([v]) => setPersonnel(v ?? 0)}
              min={100}
              max={100000}
              step={100}
            />
          </div>

          {/* Units selection */}
          {allUnits.length > 0 && (
            <div>
              <Label>Deploy Units ({selectedUnitIds.length} selected)</Label>
              <div className="mt-1 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                {allUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => toggleUnit(unit.id)}
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                      selectedUnitIds.includes(unit.id)
                        ? "border-red-500 bg-red-500/10"
                        : "border-muted hover:border-red-500/50"
                    }`}
                  >
                    <span className="font-medium">{unit.name}</span>
                    <span className="text-muted-foreground block">
                      {unit.personnel?.toLocaleString() ?? 0} personnel
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assets selection */}
          {allAssets.length > 0 && (
            <div>
              <Label>Deploy Assets ({selectedAssetIds.length} selected)</Label>
              <div className="mt-1 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                {allAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => toggleAsset(asset.id)}
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                      selectedAssetIds.includes(asset.id)
                        ? "border-red-500 bg-red-500/10"
                        : "border-muted hover:border-red-500/50"
                    }`}
                  >
                    <span className="font-medium">{asset.name}</span>
                    <span className="text-muted-foreground block">Qty: {asset.quantity ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cost preview */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Cost Estimate</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Daily Cost</p>
                <p className="font-medium">{formatCurrency(estimatedDailyCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Annual Cost</p>
                <p className="font-medium text-red-500">{formatCurrency(estimatedAnnualCost)}</p>
              </div>
            </div>
          </div>

          <Button onClick={handleDeploy} disabled={!name} className="w-full">
            Launch Operation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
