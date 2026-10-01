import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { CustomSector, AccentColor } from "./trade-commerce-types";

interface CustomSectorDialogProps {
  isOpen: boolean;
  /** Starting tariff for the new sector — the saved Fiscal Policy tariff rate, or 0. */
  defaultTariff: number;
  onClose: () => void;
  onAddSector: (sector: CustomSector) => void;
}

export const CustomSectorDialog = React.memo(function CustomSectorDialog({
  isOpen,
  defaultTariff: startingTariff,
  onClose,
  onAddSector,
}: CustomSectorDialogProps) {
  const [label, setLabel] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [defaultTariff, setDefaultTariff] = useState(String(startingTariff));
  const [defaultShare, setDefaultShare] = useState("");
  const [accent, setAccent] = useState<AccentColor>("cyan");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const share = parseFloat(defaultShare);
    if (!label.trim() || !(share > 0)) return;

    const newSector: CustomSector = {
      id: `custom-sec-${Date.now()}`,
      key: label.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      label: label.trim(),
      shortLabel: (shortLabel.trim() || label.trim()).slice(0, 12),
      defaultTariff: parseFloat(defaultTariff) || 0,
      min: 0,
      max: 50,
      step: 0.5,
      accent,
      defaultShare: share,
    };

    onAddSector(newSector);
    setLabel("");
    setShortLabel("");
    setDefaultTariff(String(startingTariff));
    setDefaultShare("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sector to Tariff Planner</DialogTitle>
          <DialogDescription>
            Planner sectors aren&apos;t saved. To record a sector for your nation, use the Country
            Editor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sec-name">Sector Name *</Label>
            <Input
              id="sec-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Rare Earth Minerals"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-short">Short Label</Label>
            <Input
              id="sec-short"
              value={shortLabel}
              onChange={(e) => setShortLabel(e.target.value)}
              placeholder="e.g. Minerals"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sec-tariff">Starting Tariff (%)</Label>
              <Input
                id="sec-tariff"
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={defaultTariff}
                onChange={(e) => setDefaultTariff(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sec-share">Share of GDP (%) *</Label>
              <Input
                id="sec-share"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={defaultShare}
                onChange={(e) => setDefaultShare(e.target.value)}
                placeholder="e.g. 12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accent Color</Label>
            <Select value={accent} onValueChange={(val) => setAccent(val as AccentColor)}>
              <SelectTrigger>
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emerald">Emerald</SelectItem>
                <SelectItem value="cyan">Cyan</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="indigo">Indigo</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Add to Planner</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
