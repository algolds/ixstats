import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  onClose: () => void;
  onAddSector: (sector: CustomSector) => void;
}

export const CustomSectorDialog = React.memo(function CustomSectorDialog({
  isOpen,
  onClose,
  onAddSector,
}: CustomSectorDialogProps) {
  const [label, setLabel] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [defaultTariff, setDefaultTariff] = useState("5.0");
  const [defaultShare, setDefaultShare] = useState("10.0");
  const [accent, setAccent] = useState<AccentColor>("teal");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    const newSector: CustomSector = {
      id: `custom-sec-${Date.now()}`,
      key: label.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      label: label.trim(),
      shortLabel: (shortLabel.trim() || label.trim()).slice(0, 12),
      defaultTariff: parseFloat(defaultTariff) || 5.0,
      min: 0,
      max: 50,
      step: 0.5,
      accent,
      defaultShare: parseFloat(defaultShare) || 10.0,
    };

    onAddSector(newSector);
    setLabel("");
    setShortLabel("");
    setDefaultTariff("5.0");
    setDefaultShare("10.0");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Declare Custom Export Sector</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sec-name">Sector Name *</Label>
            <Input
              id="sec-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Rare Earth Minerals"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sec-short">Short Label</Label>
            <Input
              id="sec-short"
              value={shortLabel}
              onChange={(e) => setShortLabel(e.target.value)}
              placeholder="e.g. Minerals"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sec-tariff">Base Tariff (%)</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="sec-share">Export Share (%)</Label>
              <Input
                id="sec-share"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={defaultShare}
                onChange={(e) => setDefaultShare(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Accent Color</Label>
            <Select value={accent} onValueChange={(val) => setAccent(val as AccentColor)}>
              <SelectTrigger>
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emerald">Emerald</SelectItem>
                <SelectItem value="cyan">Cyan</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
                <SelectItem value="rose">Rose</SelectItem>
                <SelectItem value="teal">Teal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Declare Sector</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
