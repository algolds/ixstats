"use client";

import React from "react";
import { motion } from "motion/react";
import { EditPencil as Edit, Trash as Trash2, MediaImage as Image } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { STATUS_CONFIG, type Asset } from "./asset-config";

interface AssetCardProps {
  asset: Asset;
  onViewImage: (image: { url: string; name: string }) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
}

function AssetThumbnail({ asset }: { asset: Asset }) {
  if (!asset.imageUrl) {
    return (
      <div className="bg-muted mr-4 flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border-2 border-dashed">
        <div className="flex flex-col items-center gap-1 text-center">
          <Image className="text-muted-foreground h-8 w-8" />
          <span className="text-muted-foreground text-xs">No image</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group/img relative mr-4 h-28 w-28 shrink-0 overflow-hidden rounded-lg border-2 border-orange-400 shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-orange-500 hover:shadow-lg dark:border-orange-700">
      <img
        src={asset.imageUrl}
        alt={asset.name}
        className="h-full w-full object-cover transition-transform group-hover/img:scale-110"
        onError={(e) => {
          // Hide broken images gracefully
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover/img:bg-black/60">
        <div className="flex flex-col items-center gap-1 opacity-0 transition-opacity group-hover/img:opacity-100">
          <Image className="h-6 w-6 text-white" />
          <span className="text-xs font-medium text-white">View Full Size</span>
        </div>
      </div>
    </div>
  );
}

function AssetDetails({ asset }: { asset: Asset }) {
  const status = STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG];

  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center gap-2">
        <h5 className="text-sm font-medium">{asset.name}</h5>
        <Badge variant="outline" className="text-xs">
          {asset.category}
        </Badge>
        <Badge className={status?.color}>{status?.label}</Badge>
        {asset.imageUrl && (
          <Badge variant="secondary" className="text-xs">
            <Image className="mr-1 h-3 w-3" />
            Click to view
          </Badge>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Quantity:</span>
          <span className="ml-1 font-medium">
            <NumberFlowDisplay value={asset.operational} /> /{" "}
            <NumberFlowDisplay value={asset.quantity} />
          </span>
        </div>
        {asset.acquisitionCost > 0 && (
          <div>
            <span className="text-muted-foreground">Unit Cost:</span>
            <span className="ml-1 font-medium">
              $
              <NumberFlowDisplay value={asset.acquisitionCost} format="compact" />
            </span>
          </div>
        )}
        {asset.maintenanceCost > 0 && (
          <div>
            <span className="text-muted-foreground">Maintenance:</span>
            <span className="ml-1 font-medium">
              $
              <NumberFlowDisplay value={asset.maintenanceCost} format="compact" />
              /yr
            </span>
          </div>
        )}
      </div>

      {asset.capability && (
        <p className="text-muted-foreground mt-2 line-clamp-1 text-xs">{asset.capability}</p>
      )}

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Modernization</span>
          <span className="font-medium">{asset.modernizationLevel}%</span>
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
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative overflow-hidden rounded-lg border transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:shadow-lg ${asset.imageUrl ? "cursor-pointer hover:border-orange-400" : ""}`}
      onClick={(e) => {
        // Only trigger if clicking the card itself, not buttons
        const target = e.target as HTMLElement;
        if (!target.closest("button") && asset.imageUrl) {
          console.log("Opening image modal for:", asset.name, asset.imageUrl);
          onViewImage({ url: asset.imageUrl, name: asset.name });
        }
      }}
    >
      {/* Background image with red/orange overlay */}
      {asset.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10 transition-opacity hover:opacity-15"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(239, 68, 68, 0.05), rgba(249, 115, 22, 0.05)), url(${asset.imageUrl})`,
          }}
        />
      )}

      <div className="bg-card/90 relative flex items-start justify-between p-3 backdrop-blur-sm">
        {/* Equipment image thumbnail */}
        <AssetThumbnail asset={asset} />

        <AssetDetails asset={asset} />

        <div className="ml-2 flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(asset);
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
