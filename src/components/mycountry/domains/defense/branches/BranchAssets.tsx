"use client";

import React, { useState } from "react";
import { Trash } from "iconoir-react";
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
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { formatCount } from "../forces/force-fields";

export type AssetStatus = "operational" | "maintenance" | "reserve";

export interface BranchAsset {
  id: string;
  name: string;
  category: string;
  status: string;
  quantity: number;
  operational: number;
  acquisitionCost: number;
  designYear?: number | null;
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  operational: "Operational",
  maintenance: "In maintenance",
  reserve: "In reserve",
};

const isStatus = (value: string): value is AssetStatus => value in STATUS_LABELS;

interface BranchAssetsProps {
  assets: readonly BranchAsset[];
  canEdit: boolean;
  onStatus: (id: string, status: AssetStatus) => void;
  onScrap: (id: string) => void;
}

/** The catalog equipment a branch holds; new equipment arrives only by procurement order. */
export function BranchAssets({ assets, canEdit, onStatus, onScrap }: BranchAssetsProps) {
  const [scrapping, setScrapping] = useState<BranchAsset | null>(null);
  if (assets.length === 0) {
    return (
      <p className="text-label-secondary text-footnote py-2">
        No catalog equipment yet. Order some under Procurement; until then the branch fights with
        generic equipment its procurement money buys.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-separator divide-y">
        {assets.map((asset) => (
          <li key={asset.id} className="flex flex-wrap items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-callout text-label truncate font-medium">{asset.name}</div>
              <div className="text-label-secondary text-footnote tabular-nums">
                {formatCount(asset.quantity)} × {formatCompactCurrency(asset.acquisitionCost)}
                {asset.designYear ? ` · designed ${asset.designYear}` : ""} · {asset.category}
              </div>
            </div>
            {canEdit ? (
              <div className="flex shrink-0 items-center gap-1">
                <Select
                  value={isStatus(asset.status) ? asset.status : "operational"}
                  onValueChange={(value) => onStatus(asset.id, value as AssetStatus)}
                >
                  <SelectTrigger className="h-8 w-40" aria-label={`Status of ${asset.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-label-secondary hover:text-destructive h-8 w-8"
                  aria-label={`Scrap ${asset.name}`}
                  onClick={() => setScrapping(asset)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <span className="text-label-secondary text-footnote">
                {isStatus(asset.status) ? STATUS_LABELS[asset.status] : asset.status}
              </span>
            )}
          </li>
        ))}
      </ul>
      <AlertDialog
        open={scrapping !== null}
        onOpenChange={(open) => {
          if (!open) setScrapping(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scrap {scrapping?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves service and its value leaves the branch&apos;s equipment. Nothing is
              refunded and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (scrapping) onScrap(scrapping.id);
                setScrapping(null);
              }}
            >
              Scrap
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
