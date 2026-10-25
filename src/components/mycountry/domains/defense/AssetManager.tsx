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
import { Button, buttonVariants } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { ASSET_TYPE_CONFIG, AssetCard, AssetDialog, type Asset } from "./assets";

interface AssetManagerProps {
  countryId?: string;
  branchId?: string;
  domain?: string;
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const notify = useNotify();
  const { canEdit } = useCanEdit();

  // New equipment arrives through a procurement order; it enters service when its lead time runs out.
  const orderEquipment = api.security.orderProcurement.useMutation({
    onSuccess: () => {
      notify.success("Order placed. The equipment enters service when it is delivered.");
      setShowDialog(false);
      setEditingAsset(null);
      onRefetch();
    },
    onError: (error) => {
      notify.error(`Failed to place the order: ${error.message}`);
    },
  });

  const updateAsset = api.security.updateMilitaryAsset.useMutation({
    onSuccess: () => {
      notify.success("Asset updated");
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
      notify.success("Asset scrapped");
      onRefetch();
    },
    onError: (error) => {
      notify.error(`Failed to scrap asset: ${error.message}`);
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

  const handleDelete = useCallback((assetId: string) => {
    setPendingDeleteId(assetId);
  }, []);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="text-label text-headline flex items-center gap-2">
            <Target aria-hidden="true" className="text-red h-4 w-4" />
            Assets ({assetsList.length})
          </h4>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(ASSET_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Order equipment
          </Button>
        )}
      </div>

      {filteredAssets.length > 0 ? (
        <div className="space-y-3">
          {Object.entries(assetsByType).map(([type, typeAssets]) => {
            const config = ASSET_TYPE_CONFIG[type as keyof typeof ASSET_TYPE_CONFIG];
            const Icon = config?.icon ?? Target;

            return (
              <div key={type} className="space-y-2">
                <div className="text-label-secondary text-body flex items-center gap-2 font-medium">
                  <Icon aria-hidden="true" className="h-4 w-4" />
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
        <div className="text-label-secondary border-separator rounded-control text-body border border-dashed py-6 text-center">
          No assets yet. Order equipment from the catalog to get started.
        </div>
      )}

      {viewingImage && (
        <Dialog open={true} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingImage.name}</DialogTitle>
              <DialogDescription>Equipment Image - Click outside to close</DialogDescription>
            </DialogHeader>
            <div className="bg-fill-3 rounded-control relative w-full overflow-hidden">
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

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scrap this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              The asset leaves service and its value leaves the branch&apos;s capital. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (pendingDeleteId) deleteAsset.mutate({ id: pendingDeleteId });
                setPendingDeleteId(null);
              }}
            >
              Scrap
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssetDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        asset={editingAsset}
        onCreate={(data) => {
          if (!data.catalogKey) {
            notify.error("Choose equipment from the catalog: new assets arrive through orders.");
            return;
          }
          orderEquipment.mutate({
            branchId,
            catalogKey: data.catalogKey,
            quantity: Math.max(1, Math.floor(data.quantity)),
            source: data.source,
          });
        }}
        onUpdate={(id, data) =>
          updateAsset.mutate({
            id,
            asset: {
              name: data.name,
              capability: data.capability || null,
              status: data.status,
              operational: data.operational,
              imageUrl: data.imageUrl || null,
            },
          })
        }
      />
    </div>
  );
}
