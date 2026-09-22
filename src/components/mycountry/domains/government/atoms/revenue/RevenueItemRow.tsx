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
import { Xmark as X } from "iconoir-react";
import { formatExactCurrency } from "~/lib/utils";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import {
  revenueCategories,
  revenueCategoryIcons,
  revenueCategoryColors,
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
  const color = revenueCategoryColors[item.category];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 transition-all hover:bg-zinc-100/50 dark:border-white/5 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {!isReadOnly && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 h-7 w-7 rounded-lg p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Column 1: Basic Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-100 dark:border-white/5 dark:bg-zinc-950">
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <Input
              value={item.name}
              onChange={(e) => onUpdate(index, "name", e.target.value)}
              placeholder="Revenue source name"
              disabled={isReadOnly}
              className="h-8 border-zinc-200 bg-white font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500/30 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white dark:placeholder:text-zinc-600"
            />
          </div>

          <Select
            value={item.category}
            onValueChange={(value: RevenueCategory) => onUpdate(index, "category", value)}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-8 border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
              {revenueCategories.map((category) => {
                const CategoryIcon = revenueCategoryIcons[category];
                return (
                  <SelectItem
                    key={category}
                    value={category}
                    className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                  >
                    <div className="flex items-center">
                      <CategoryIcon
                        className="mr-2 h-3.5 w-3.5"
                        style={{ color: revenueCategoryColors[category] }}
                      />
                      {category}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <textarea
            value={item.description || ""}
            onChange={(e) => onUpdate(index, "description", e.target.value)}
            placeholder="Specify funding notes or legislative codes..."
            disabled={isReadOnly}
            rows={2}
            className="dark:placeholder:text-zinc-650 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
          />
        </div>

        {/* Column 2: Financial Details */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Annual Yield Amount
            </Label>
            <div className="relative">
              <span className="absolute top-1.5 left-2.5 text-xs text-zinc-500">$</span>
              <Input
                type="number"
                value={item.revenueAmount}
                onChange={(e) =>
                  onUpdate(index, "revenueAmount", parseFloat(e.target.value) || 0)
                }
                disabled={isReadOnly || isLocked("revenueSources")}
                min="0"
                step="1000000"
                className="h-8 border-zinc-200 bg-white pl-6 text-zinc-900 focus:border-cyan-500/30 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
              />
            </div>
            <p className="mt-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              {formatExactCurrency(item.revenueAmount, currency)} (
              {(item.revenuePercent ?? 0).toFixed(1)}% share)
            </p>
          </div>

          {item.category.includes("Tax") && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Active Tax Rate (%)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={item.rate || 0}
                  onChange={(e) =>
                    onUpdate(index, "rate", parseFloat(e.target.value) || 0)
                  }
                  disabled={isReadOnly}
                  min="0"
                  max="100"
                  step="0.1"
                  className="h-8 border-zinc-200 bg-white pr-6 text-zinc-900 focus:border-cyan-500/30 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
                />
                <span className="absolute top-1.5 right-2.5 text-xs text-zinc-500">%</span>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Administration */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Collection Channel
            </Label>
            <Select
              value={item.collectionMethod || ""}
              onValueChange={(value) => onUpdate(index, "collectionMethod", value)}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-8 border-zinc-200 bg-white text-xs text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
                <SelectValue placeholder="Select collection method" />
              </SelectTrigger>
              <SelectContent className="max-h-80 border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
                {getCollectionMethodsForCategory(item.category).map((method) => {
                  const IconComponent = getCollectionMethodIcon(method.icon);
                  return (
                    <SelectItem
                      key={method.id}
                      value={method.id}
                      className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: method.color }}
                        />
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold">{method.name}</span>
                          <span className="text-[9px] text-zinc-500">{method.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Administrative Authority
            </Label>
            {availableDepartments.length > 0 ? (
              <Select
                value={item.administeredBy || ""}
                onValueChange={(value) => onUpdate(index, "administeredBy", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-8 border-zinc-200 bg-white text-xs text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
                  {availableDepartments
                    .filter((dept) => dept.name && dept.name.trim() !== "")
                    .map((dept) => (
                      <SelectItem
                        key={dept.id}
                        value={dept.name}
                        className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                      >
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
                className="h-8 border-zinc-200 bg-white text-zinc-900 focus:border-cyan-500/30 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
