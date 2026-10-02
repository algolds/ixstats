"use client";

import React from "react";
import { EditPencil as Edit, Trash as Trash2, MediaImage as Image } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { STATUS_CONFIG, type Asset } from "./asset-config";
import { Card } from "~/components/ui/card";

interface AssetCardProps {
  asset: Asset;
  onViewImage: (image: { url: string; name: string }) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
}

function AssetThumbnail({
  asset,
  onViewImage,
}: {
  asset: Asset;
  onViewImage: AssetCardProps["onViewImage"];
}) {
  if (!asset.imageUrl) {
    return (
      <div className="bg-fill-3 border-separator rounded-control mr-4 flex h-28 w-28 shrink-0 items-center justify-center border border-dashed">
        <div className="flex flex-col items-center gap-1 text-center">
          <Image aria-hidden="true" className="text-label-secondary h-8 w-8" />
          <span className="text-label-secondary text-footnote">No image</span>
        </div>
      </div>
    );
  }

  const imageUrl = asset.imageUrl;
  return (
    <button
      type="button"
      aria-label={`View full-size image of ${asset.name}`}
      onClick={(e) => {
        e.stopPropagation();
        onViewImage({ url: imageUrl, name: asset.name });
      }}
      className="border-separator hover:border-separator-opaque focus-visible:ring-tint rounded-control mr-4 h-28 w-28 shrink-0 cursor-pointer overflow-hidden border transition-[border-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
    >
      <img
        src={imageUrl}
        alt={asset.name}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Hide broken images gracefully
          e.currentTarget.style.display = "none";
        }}
      />
    </button>
  );
}

function AssetDetails({ asset }: { asset: Asset }) {
  const status = STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG];

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h5 className="text-label text-body font-medium">{asset.name}</h5>
        <Badge variant="outline">{asset.category}</Badge>
        {status && (
          <Badge variant="outline" className={status.color}>
            {status.label}
          </Badge>
        )}
      </div>

      <div className="text-footnote mt-2 grid grid-cols-3 gap-3">
        <div>
          <span className="text-label-secondary">Quantity:</span>
          <span className="ml-1 font-medium tabular-nums">
            <NumberFlowDisplay value={asset.operational} /> /{" "}
            <NumberFlowDisplay value={asset.quantity} />
          </span>
        </div>
        {asset.acquisitionCost > 0 && (
          <div>
            <span className="text-label-secondary">Unit Cost:</span>
            <span className="ml-1 font-medium tabular-nums">
              $
              <NumberFlowDisplay value={asset.acquisitionCost} format="compact" />
            </span>
          </div>
        )}
        {asset.maintenanceCost > 0 && (
          <div>
            <span className="text-label-secondary">Maintenance:</span>
            <span className="ml-1 font-medium tabular-nums">
              $
              <NumberFlowDisplay value={asset.maintenanceCost} format="compact" />
              /yr
            </span>
          </div>
        )}
      </div>

      {asset.capability && (
        <p className="text-label-secondary text-footnote mt-2 line-clamp-1">{asset.capability}</p>
      )}

      <div className="mt-2">
        <div className="text-footnote mb-1 flex items-center justify-between">
          <span className="text-label-secondary">Modernization</span>
          <span className="font-medium tabular-nums">{asset.modernizationLevel}%</span>
        </div>
        <Progress value={asset.modernizationLevel} className="h-1" />
      </div>
    </div>
  );
}

export const AssetCard = React.memo(function AssetCard({
  asset,
  onViewImage,
  onEdit,
  onDelete,
}: AssetCardProps) {
  return (
    <Card>
      <div
        className={cn("flex items-start justify-between p-3", asset.imageUrl && "cursor-pointer")}
        onClick={(e) => {
          // Only trigger if clicking the card itself, not buttons
          const target = e.target as HTMLElement;
          if (!target.closest("button") && asset.imageUrl) {
            onViewImage({ url: asset.imageUrl, name: asset.name });
          }
        }}
      >
        <AssetThumbnail asset={asset} onViewImage={onViewImage} />

        <AssetDetails asset={asset} />

        <div className="ml-2 flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label={`Edit ${asset.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(asset);
            }}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-label-secondary hover:text-destructive h-8 w-8"
            aria-label={`Delete ${asset.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
});
