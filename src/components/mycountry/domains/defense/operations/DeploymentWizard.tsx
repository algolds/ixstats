"use client";

import { useState } from "react";
import {
  Archery as Crosshair,
  Shield,
  SeaWaves as Anchor,
  Tournament as Swords,
  GraduationCap,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Toggle } from "~/components/ui/toggle";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { formatCurrency } from "~/lib/utils/format-utils";

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
    label: "Defense pact",
    icon: Crosshair,
    description: "Deploy forces to defend an ally",
  },
  {
    value: "blockade",
    label: "Naval blockade",
    icon: Anchor,
    description: "Block enemy ports, high cost",
  },
  {
    value: "intervention",
    label: "Military intervention",
    icon: Swords,
    description: "Direct military action",
  },
  {
    value: "training",
    label: "Training exercise",
    icon: GraduationCap,
    description: "Improve readiness",
  },
] as const;

export function DeploymentWizard({ countryId, onSuccess }: DeploymentWizardProps) {
  const notify = useNotify();
  const { canEdit } = useCanEdit();
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

  const { data: relationships } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: open }
  );

  const resetForm = () => {
    setName("");
    setDescription("");
    setTargetCountryId("");
    setPersonnel(1000);
    setSelectedUnitIds([]);
    setSelectedAssetIds([]);
  };

  const createOperation = api.security.createOperation.useMutation({
    onSuccess: () => {
      notify.success("Operation launched!", `${name} has been deployed.`);
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      notify.error("Failed to launch operation", error.message);
    },
  });

  const handleDeploy = () => {
    if (!name.trim()) {
      notify.error("Operation name is required");
      return;
    }
    createOperation.mutate({
      countryId,
      operationType: operationType as
        "peacekeeping" | "defense_pact" | "blockade" | "intervention" | "training",
      name,
      description: description || undefined,
      targetCountryId: targetCountryId || undefined,
      personnelDeployed: personnel,
      unitIds: selectedUnitIds,
      assetIds: selectedAssetIds,
    });
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">Deploy forces</Button>
      </SheetTrigger>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Deploy military forces</SheetTitle>
          <SheetDescription>
            Create a military operation and assign units and assets.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Operation name and type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operation name</Label>
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
                        <t.icon aria-hidden="true" className="text-label-secondary h-4 w-4" />
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
                  <Toggle
                    key={unit.id}
                    variant="outline"
                    pressed={selectedUnitIds.includes(unit.id)}
                    onPressedChange={() => toggleUnit(unit.id)}
                    className="text-footnote data-[state=on]:border-red/50 h-auto min-w-0 flex-col items-start gap-0 p-2 text-left"
                  >
                    <span className="w-full truncate font-medium">{unit.name}</span>
                    <span className="text-label-secondary block w-full truncate font-normal">
                      {unit.personnel?.toLocaleString() ?? 0} personnel
                    </span>
                  </Toggle>
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
                  <Toggle
                    key={asset.id}
                    variant="outline"
                    pressed={selectedAssetIds.includes(asset.id)}
                    onPressedChange={() => toggleAsset(asset.id)}
                    className="text-footnote data-[state=on]:border-red/50 h-auto min-w-0 flex-col items-start gap-0 p-2 text-left"
                  >
                    <span className="w-full truncate font-medium">{asset.name}</span>
                    <span className="text-label-secondary block w-full truncate font-normal">
                      Qty: {asset.quantity ?? 0}
                    </span>
                  </Toggle>
                ))}
              </div>
            </div>
          )}

          {/* Cost preview */}
          <div className="border-separator rounded-control border p-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle aria-hidden="true" className="text-yellow h-4 w-4" />
              <span className="text-label text-body font-medium">Cost estimate</span>
            </div>
            <div className="text-body grid grid-cols-2 gap-3">
              <div>
                <span className="text-stat-label text-label-secondary block">Daily cost</span>
                <p className="font-medium tabular-nums">{formatCurrency(estimatedDailyCost)}</p>
              </div>
              <div>
                <span className="text-stat-label text-label-secondary block">Annual cost</span>
                <p className="font-medium tabular-nums">{formatCurrency(estimatedAnnualCost)}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleDeploy}
            disabled={!canEdit || !name.trim() || createOperation.isPending}
            className="w-full"
          >
            {!canEdit
              ? "Premium required"
              : createOperation.isPending
                ? "Launching..."
                : "Launch Operation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
