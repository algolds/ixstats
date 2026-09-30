"use client";

import React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { FacetContainer } from "~/components/ui/facet-container";
import { Xmark as X } from "iconoir-react";
import { formatExactCurrency } from "~/lib/utils";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import {
  revenueCategories,
  revenueCategoryIcons,
  getCollectionMethodIcon,
  getCollectionMethodsForCategory,
} from "./revenueConstants";

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
    <FacetContainer depth={3} surface="solid" enableRefraction={false} className="rounded-lg p-4">
      {!isReadOnly && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.name || "revenue source"}`}
          className="text-muted-foreground hover:text-destructive absolute top-2 right-2 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Column 1: Basic Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />
            <Input
              value={item.name}
              onChange={(e) => onUpdate(index, "name", e.target.value)}
              placeholder="Revenue source name"
              disabled={isReadOnly}
              className="h-8 font-bold"
            />
          </div>

          <Select
            value={item.category}
            onValueChange={(value: RevenueCategory) => onUpdate(index, "category", value)}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {revenueCategories.map((category) => {
                const CategoryIcon = revenueCategoryIcons[category];
                return (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center">
                      <CategoryIcon className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                      {category}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Textarea
            value={item.description || ""}
            onChange={(e) => onUpdate(index, "description", e.target.value)}
            placeholder="Specify funding notes or legislative codes..."
            disabled={isReadOnly}
            rows={2}
            className="min-h-0 resize-none text-xs"
          />
        </div>

        {/* Column 2: Financial Details */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">Annual Yield Amount</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2 text-xs">
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
            <p className="text-muted-foreground mt-1 text-xs font-semibold">
              {formatExactCurrency(item.revenueAmount, currency)} (
              {(item.revenuePercent ?? 0).toFixed(1)}% share)
            </p>
          </div>

          {item.category.includes("Tax") && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                Active Tax Rate (%)
              </Label>
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
                <span className="text-muted-foreground absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
                  %
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Administration */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">Collection Channel</Label>
            <Select
              value={item.collectionMethod || ""}
              onValueChange={(value) => onUpdate(index, "collectionMethod", value)}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select collection method" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {getCollectionMethodsForCategory(item.category).map((method) => {
                  const IconComponent = getCollectionMethodIcon(method.icon);
                  return (
                    <SelectItem key={method.id} value={method.id}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold">{method.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {method.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">
              Administrative Authority
            </Label>
            {availableDepartments.length > 0 ? (
              <Select
                value={item.administeredBy || ""}
                onValueChange={(value) => onUpdate(index, "administeredBy", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments
                    .filter((dept) => dept.name && dept.name.trim() !== "")
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={item.administeredBy || ""}
                onChange={(e) => onUpdate(index, "administeredBy", e.target.value)}
                placeholder="Ministry or Agency Name"
                disabled={isReadOnly}
                className="h-8"
              />
            )}
          </div>
        </div>
      </div>
    </FacetContainer>
  );
}
