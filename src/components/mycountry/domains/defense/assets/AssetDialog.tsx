"use client";

import React, { useState } from "react";
import { CheckCircle as CheckCircle2 } from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useNotify } from "~/hooks/useNotify";
import {
  applyEquipmentPreset,
  filterEquipment,
  toFormData,
  type Asset,
  type AssetFormData,
  type EquipmentPreset,
} from "./asset-config";
import { EquipmentBrowser } from "./EquipmentBrowser";
import { AssetFormFields } from "./AssetFormFields";

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
  onCreate: (data: AssetFormData) => void;
  onUpdate: (id: string, data: AssetFormData) => void;
}

export function AssetDialog({ open, onOpenChange, asset, onCreate, onUpdate }: AssetDialogProps) {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEra, setSelectedEra] = useState<string>("all");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");

  const [formData, setFormData] = useState<AssetFormData>(() => toFormData(asset));

  React.useEffect(() => {
    if (asset) {
      // oxlint-disable-next-line
      setFormData(toFormData(asset));
    }
  }, [asset, open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      notify.error("Asset name is required");
      return;
    }

    if (asset) {
      onUpdate(asset.id, formData);
    } else {
      onCreate(formData);
    }
  };

  const loadEquipment = (equipment: EquipmentPreset) => {
    setFormData(applyEquipmentPreset(formData, equipment));
    setActiveTab("manual");
    notify.success("Equipment template loaded" + (equipment.imageUrl ? " with image" : ""));
  };

  const filteredEquipment = filterEquipment({
    searchQuery,
    era: selectedEra,
    manufacturer: selectedManufacturer,
    assetType: formData.assetType,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
          <DialogDescription>
            Browse real-world military equipment or create custom assets
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Equipment</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            <EquipmentBrowser
              equipment={filteredEquipment}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              selectedEra={selectedEra}
              onSelectedEraChange={setSelectedEra}
              selectedManufacturer={selectedManufacturer}
              onSelectedManufacturerChange={setSelectedManufacturer}
              onSelect={loadEquipment}
            />
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <AssetFormFields formData={formData} onChange={setFormData} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {asset ? "Update Asset" : "Add Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
