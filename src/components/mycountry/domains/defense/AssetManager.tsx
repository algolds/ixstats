"use client";
// src/components/defense/AssetManager.tsx

import React, { useCallback, useState } from "react";
import { api } from "~/trpc/react";
import { Plus, Archery as Target } from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { ASSET_TYPE_CONFIG, AssetCard, AssetDialog, type Asset } from "./assets";

export interface AssetManagerProps {
  countryId?: string;
  branchId?: string;
  branchType?: string;
  assets?: Asset[];
  onRefetch?: () => void;
}

export function AssetManager({
  branchId = "",
  assets = [],
  onRefetch = () => {},
}: AssetManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);

  const notify = useNotify();

  const createAsset = api.security.createMilitaryAsset.useMutation({
    onSuccess: () => {
      notify.success("Asset created successfully");
      setShowDialog(false);
      setEditingAsset(null);
      onRefetch();
    },
    onError: (error) => {
      notify.error(`Failed to create asset: ${error.message}`);
    },
  });

  const updateAsset = api.security.updateMilitaryAsset.useMutation({
    onSuccess: () => {
      notify.success("Asset updated successfully");
      setShowDialog(false);
      setEditingAsset(null);
      onRefetch();
    },
    onError: (error) => {
      notify.error(`Failed to update asset: ${error.message}`);
    },
  });

  const deleteAsset = api.security.deleteMilitaryAsset.useMutation({
    onSuccess: () => {
      notify.success("Asset deleted successfully");
      onRefetch();
    },
    onError: (error) => {
      notify.error(`Failed to delete asset: ${error.message}`);
    },
  });

  const handleCreate = () => {
    setEditingAsset(null);
    setShowDialog(true);
  };

  const handleEdit = useCallback((asset: Asset) => {
    setEditingAsset(asset);
    setShowDialog(true);
  }, []);

  const deleteAssetMutate = deleteAsset.mutate;
  const handleDelete = useCallback(
    (assetId: string) => {
      if (confirm("Are you sure you want to delete this asset?")) {
        deleteAssetMutate({ id: assetId });
      }
    },
    [deleteAssetMutate]
  );

  const assetsList = assets ?? [];
  const filteredAssets =
    filterType === "all" ? assetsList : assetsList.filter((a) => a.assetType === filterType);

  // Group assets by type
  const assetsByType = (filteredAssets ?? []).reduce(
    (acc, asset) => {
      if (!acc[asset.assetType]) {
        acc[asset.assetType] = [];
      }
      acc[asset.assetType].push(asset);
      return acc;
    },
    {} as Record<string, Asset[]>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4" />
            Assets ({assetsList.length})
          </h4>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ASSET_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-3 w-3" />
          Add Asset
        </Button>
      </div>

      {filteredAssets.length > 0 ? (
        <div className="space-y-3">
          {Object.entries(assetsByType).map(([type, typeAssets]) => {
            const config = ASSET_TYPE_CONFIG[type as keyof typeof ASSET_TYPE_CONFIG];
            const Icon = config?.icon ?? Target;

            return (
              <div key={type} className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <Icon className={`h-4 w-4 ${config?.color}`} />
                  {config?.label} ({typeAssets.length})
                </div>

                <div className="space-y-2 pl-6">
                  {typeAssets.map((asset: Asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onViewImage={setViewingImage}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
          No assets yet. Add your first asset to get started.
        </div>
      )}

      {/* Image Viewing Modal */}
      {viewingImage && (
        <Dialog open={true} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingImage.name}</DialogTitle>
              <DialogDescription>Equipment Image - Click outside to close</DialogDescription>
            </DialogHeader>
            <div className="relative w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
              <img
                src={viewingImage.url}
                alt={viewingImage.name}
                className="h-auto w-full object-contain"
                style={{ maxHeight: "70vh" }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AssetDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        asset={editingAsset}
        onCreate={(data) => createAsset.mutate({ branchId, asset: data })}
        onUpdate={(id, data) => updateAsset.mutate({ id, asset: data })}
      />
    </div>
  );
}

export default AssetManager;
