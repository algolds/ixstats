"use client";

import React, { useRef, useCallback } from "react";
import { formatExactCurrency } from "~/lib/utils";
import { usePendingLocks } from "~/hooks/usePendingLocks";
import { Badge } from "~/components/ui/badge";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { Coins } from "iconoir-react";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import {
  revenueCategories,
  revenueCategoryIcons,
  revenueCategoryColors,
  commonRevenueSources,
  getCollectionMethodIcon,
  getCollectionMethodsForCategory,
  RevenueSummaryKpis,
  RevenueItemRow,
  RevenueAddSection,
} from "./revenue";

export {
  revenueCategories,
  revenueCategoryIcons,
  revenueCategoryColors,
  commonRevenueSources,
  getCollectionMethodIcon,
  getCollectionMethodsForCategory,
};

export interface RevenueSourceFormProps {
  data: RevenueSourceInput[];
  onChange: (data: RevenueSourceInput[]) => void;
  totalRevenue: number;
  currency: string;
  isReadOnly?: boolean;
  availableDepartments?: { id: string; name: string }[];
}

export function RevenueSourceForm({
  data,
  onChange,
  totalRevenue,
  currency = "USD",
  isReadOnly = false,
  availableDepartments = [],
}: RevenueSourceFormProps) {
  const { isLocked } = usePendingLocks();

  const dataRef = useRef(data);
  dataRef.current = data;
  const totalRevenueRef = useRef(totalRevenue);
  totalRevenueRef.current = totalRevenue;

  const totalCalculated = data.reduce((sum, item) => sum + item.revenueAmount, 0);
  const totalPercent = data.reduce((sum, item) => sum + (item.revenuePercent ?? 0), 0);

  const handleUpdate = useCallback(
    (index: number, field: keyof RevenueSourceInput, value: string | number) => {
      const updated = [...dataRef.current];
      const existing = updated[index];
      if (!existing) return;

      updated[index] = {
        ...existing,
        [field]: value,
      };

      if (field === "revenueAmount" && typeof value === "number" && totalRevenueRef.current > 0) {
        updated[index].revenuePercent = (value / totalRevenueRef.current) * 100;
      }

      onChange(updated);
    },
    [onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = dataRef.current.filter((_, i) => i !== index);
      onChange(updated);
    },
    [onChange]
  );

  const handleAddCustom = useCallback(
    (newRevenue: RevenueSourceInput) => {
      const revenueToAdd = {
        ...newRevenue,
        revenuePercent:
          totalRevenueRef.current > 0
            ? (newRevenue.revenueAmount / totalRevenueRef.current) * 100
            : 0,
      };
      onChange([...dataRef.current, revenueToAdd]);
    },
    [onChange]
  );

  const handleAddPreset = useCallback(
    (name: string, category: RevenueCategory) => {
      const preset: RevenueSourceInput = {
        name,
        category,
        description: `${name} revenue collection`,
        rate: category.includes("Tax") ? 10 : undefined,
        revenueAmount: totalRevenue * 0.1,
        collectionMethod: "automatic_deduction",
        administeredBy:
          availableDepartments.find(
            (d) => d.name.includes("Finance") || d.name.includes("Treasury")
          )?.name || "Ministry of Finance",
      };

      onChange([
        ...data,
        {
          ...preset,
          revenuePercent: totalRevenue > 0 ? (preset.revenueAmount / totalRevenue) * 100 : 0,
        },
      ]);
    },
    [data, totalRevenue, availableDepartments, onChange]
  );

  return (
    <FacetCard
      depth={1}
      className="facet-surface facet-refraction border-cyan-500/20 bg-card/60 backdrop-blur-md"
    >
      <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
        <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
          <Coins className="h-5 w-5 text-cyan-400" />
          Revenue Channels
        </h3>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "border font-semibold shadow-none",
              totalPercent > 100
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
            )}
          >
            {data.length} Channels
          </Badge>
          <Badge className="border border-zinc-200 bg-zinc-100 font-semibold text-zinc-700 dark:border-white/5 dark:bg-zinc-800 dark:text-zinc-300">
            {formatExactCurrency(totalCalculated, currency)}
          </Badge>
        </div>
      </div>

      <FacetCardContent className="space-y-6 p-6">
        {/* KPI Summary Cards & Category Breakdown */}
        <RevenueSummaryKpis data={data} totalCalculated={totalCalculated} />

        {/* Existing Revenue Channels list */}
        <div className="space-y-4">
          {data.map((item, index) => (
            <RevenueItemRow
              key={index}
              item={item}
              index={index}
              isReadOnly={isReadOnly}
              currency={currency}
              availableDepartments={availableDepartments}
              isLocked={isLocked}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {/* Add New Revenue Source Form & Presets */}
        {!isReadOnly && (
          <RevenueAddSection
            onAddCustom={handleAddCustom}
            onAddPreset={handleAddPreset}
            availableDepartments={availableDepartments}
          />
        )}
      </FacetCardContent>
    </FacetCard>
  );
}
