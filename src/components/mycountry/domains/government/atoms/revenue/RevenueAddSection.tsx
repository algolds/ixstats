"use client";

import React, { useState } from "react";
import { Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import {
  revenueCategories,
  revenueCategoryIcons,
  revenueCategoryColors,
  commonRevenueSources,
  getCollectionMethodIcon,
  getCollectionMethodsForCategory,
} from "./revenueConstants";

interface RevenueAddSectionProps {
  onAddCustom: (newRevenue: RevenueSourceInput) => void;
  onAddPreset: (name: string, category: RevenueCategory) => void;
  availableDepartments?: { id: string; name: string }[];
}

export function RevenueAddSection({
  onAddCustom,
  onAddPreset,
  availableDepartments = [],
}: RevenueAddSectionProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRevenue, setNewRevenue] = useState<RevenueSourceInput>({
    name: "",
    category: "Direct Tax",
    description: "",
    rate: 0,
    revenueAmount: 0,
    collectionMethod: "",
    administeredBy: "",
  });

  const handleAdd = () => {
    if (newRevenue.name.trim()) {
      onAddCustom(newRevenue);
      setNewRevenue({
        name: "",
        category: "Direct Tax",
        description: "",
        rate: 0,
        revenueAmount: 0,
        collectionMethod: "",
        administeredBy: "",
      });
      setIsAddingNew(false);
    }
  };

  if (!isAddingNew) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => setIsAddingNew(true)}
          className="h-12 w-full rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-100 text-zinc-600 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-950/10 dark:text-zinc-300 dark:hover:text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Revenue Source
        </Button>

        {/* Quick Add Presets badges */}
        <div className="space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/5 dark:bg-black/10">
          <Label className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Quick Add Common Channels:
          </Label>
          <div className="space-y-3">
            {revenueCategories.map((category) => (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  {React.createElement(revenueCategoryIcons[category], {
                    className: "h-3.5 w-3.5",
                    style: { color: revenueCategoryColors[category] },
                  })}
                  {category}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {commonRevenueSources[category].map((source) => (
                    <Button
                      key={source}
                      variant="outline"
                      size="sm"
                      onClick={() => onAddPreset(source, category)}
                      className="h-7 border-zinc-200 bg-zinc-100 text-xs text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {source}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border-2 border-dashed border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="text-xs font-bold tracking-wider text-cyan-500 uppercase dark:text-cyan-400">
        Configure Custom Revenue Channel
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Input
            value={newRevenue.name}
            onChange={(e) => setNewRevenue((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Revenue channel name (e.g. Carbon Levy)"
            className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
          />

          <Select
            value={newRevenue.category}
            onValueChange={(value: RevenueCategory) =>
              setNewRevenue((prev) => ({ ...prev, category: value }))
            }
          >
            <SelectTrigger className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
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
                        className="mr-2 h-4 w-4"
                        style={{ color: revenueCategoryColors[category] }}
                      />
                      {category}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Input
            type="number"
            value={newRevenue.revenueAmount || ""}
            onChange={(e) =>
              setNewRevenue((prev) => ({
                ...prev,
                revenueAmount: parseFloat(e.target.value) || 0,
              }))
            }
            placeholder="Annual yield amount"
            min="0"
            step="1000000"
            className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
          />

          {newRevenue.category.includes("Tax") && (
            <Input
              type="number"
              value={newRevenue.rate || ""}
              onChange={(e) =>
                setNewRevenue((prev) => ({
                  ...prev,
                  rate: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="Tax rate (%)"
              min="0"
              max="100"
              step="0.1"
              className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Collection Method
          </Label>
          <Select
            value={newRevenue.collectionMethod || ""}
            onValueChange={(value) =>
              setNewRevenue((prev) => ({ ...prev, collectionMethod: value }))
            }
          >
            <SelectTrigger className="border-zinc-200 bg-white text-xs text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
              <SelectValue placeholder="Select collection method" />
            </SelectTrigger>
            <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
              {getCollectionMethodsForCategory(newRevenue.category).map((method) => {
                const IconComponent = getCollectionMethodIcon(method.icon);
                return (
                  <SelectItem
                    key={method.id}
                    value={method.id}
                    className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent
                        className="h-4 w-4 shrink-0"
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
          <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Administrative Authority
          </Label>
          {availableDepartments.length > 0 ? (
            <Select
              value={newRevenue.administeredBy || ""}
              onValueChange={(value) =>
                setNewRevenue((prev) => ({ ...prev, administeredBy: value }))
              }
            >
              <SelectTrigger className="border-zinc-200 bg-white text-xs text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
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
              value={newRevenue.administeredBy || ""}
              onChange={(e) =>
                setNewRevenue((prev) => ({ ...prev, administeredBy: e.target.value }))
              }
              placeholder="Department or agency name"
              className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Description</Label>
        <Input
          value={newRevenue.description || ""}
          onChange={(e) =>
            setNewRevenue((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Brief description of this revenue source"
          className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleAdd} size="sm" className="bg-cyan-500 font-bold text-black hover:bg-cyan-600">
          <Plus className="mr-1 h-4 w-4" />
          Add Channel
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsAddingNew(false)}
          size="sm"
          className="text-zinc-650 border-zinc-200 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
