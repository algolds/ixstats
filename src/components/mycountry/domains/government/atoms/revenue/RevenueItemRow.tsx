"use client";

import React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Xmark as X } from "iconoir-react";
import { formatExactCurrency } from "~/lib/utils";
import type { RevenueSourceInput } from "~/types/government";
import { revenueCategoryIcons } from "./revenueConstants";
import {
  AdministeredBySelect,
  CollectionMethodSelect,
  RevenueCategorySelect,
} from "./RevenueSelects";
import { Card } from "~/components/ui/card";

interface RevenueItemRowProps {
  item: RevenueSourceInput;
  index: number;
  isReadOnly?: boolean;
  currency: string;
  availableDepartments?: { id: string; name: string }[];
  isLocked: (key: string) => boolean;
  onUpdate: (index: number, field: keyof RevenueSourceInput, value: string | number) => void;
  onRemove: (index: number) => void;
}

export function RevenueItemRow({
  item,
  index,
  isReadOnly = false,
  currency,
  availableDepartments = [],
  isLocked,
  onUpdate,
  onRemove,
}: RevenueItemRowProps) {
  const Icon = revenueCategoryIcons[item.category];

  return (
    <Card variant="well" className="p-4">
      {!isReadOnly && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.name || "revenue source"}`}
          className="text-label-secondary hover:text-destructive absolute top-2 right-2 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Column 1: Basic Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
            <Input
              value={item.name}
              onChange={(e) => onUpdate(index, "name", e.target.value)}
              placeholder="Revenue source name"
              disabled={isReadOnly}
              className="h-8 font-semibold"
            />
          </div>

          <RevenueCategorySelect
            value={item.category}
            onChange={(value) => onUpdate(index, "category", value)}
            disabled={isReadOnly}
            dense
          />

          <Textarea
            value={item.description || ""}
            onChange={(e) => onUpdate(index, "description", e.target.value)}
            placeholder="Specify funding notes or legislative codes..."
            disabled={isReadOnly}
            rows={2}
            className="text-footnote min-h-0 resize-none"
          />
        </div>

        {/* Column 2: Financial Details */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-label-secondary text-caption">Annual yield amount</Label>
            <div className="relative">
              <span className="text-label-secondary text-footnote absolute top-1/2 left-3 -translate-y-1/2">
                $
              </span>
              <Input
                type="number"
                value={item.revenueAmount}
                onChange={(e) => onUpdate(index, "revenueAmount", parseFloat(e.target.value) || 0)}
                disabled={isReadOnly || isLocked("revenueSources")}
                min="0"
                step="1000000"
                className="h-8 pl-6"
              />
            </div>
            <p className="text-label-secondary text-caption mt-1 font-semibold">
              {formatExactCurrency(item.revenueAmount, currency)} (
              {(item.revenuePercent ?? 0).toFixed(1)}% share)
            </p>
          </div>

          {item.category.includes("Tax") && (
            <div className="space-y-2">
              <Label className="text-label-secondary text-caption">Active Tax Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={item.rate || 0}
                  onChange={(e) => onUpdate(index, "rate", parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  min="0"
                  max="100"
                  step="0.1"
                  className="h-8 pr-6"
                />
                <span className="text-label-secondary text-footnote absolute top-1/2 right-3 -translate-y-1/2">
                  %
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Administration */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-label-secondary text-caption">Collection channel</Label>
            <CollectionMethodSelect
              category={item.category}
              value={item.collectionMethod || ""}
              onChange={(value) => onUpdate(index, "collectionMethod", value)}
              disabled={isReadOnly}
              dense
            />
          </div>

          <div className="space-y-2">
            <Label className="text-label-secondary text-caption">Administrative authority</Label>
            <AdministeredBySelect
              value={item.administeredBy || ""}
              onChange={(value) => onUpdate(index, "administeredBy", value)}
              disabled={isReadOnly}
              dense
              departments={availableDepartments}
              placeholder="Ministry or agency name"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
