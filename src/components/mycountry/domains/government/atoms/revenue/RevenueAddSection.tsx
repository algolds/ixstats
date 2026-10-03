"use client";

import React, { useState } from "react";
import { Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Eyebrow } from "~/components/ui/eyebrow";
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
  commonRevenueSources,
  getCollectionMethodIcon,
  getCollectionMethodsForCategory,
} from "./revenueConstants";
import { Card } from "~/components/ui/card";

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
          className="h-11 w-full border-dashed"
        >
          <Plus className="h-4 w-4" />
          Add custom revenue source
        </Button>

        {/* Quick Add Presets badges */}
        <div className="border-separator rounded-control space-y-3 border p-4">
          <h3 className="text-label text-headline">Quick add common channels</h3>
          <div className="space-y-3">
            {revenueCategories.map((category) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  {React.createElement(revenueCategoryIcons[category], {
                    className: "text-label-secondary h-3.5 w-3.5",
                  })}
                  <Eyebrow>{category}</Eyebrow>
                </div>
                <div className="flex flex-wrap gap-2">
                  {commonRevenueSources[category].map((source) => (
                    <Button
                      key={source}
                      variant="outline"
                      size="xs"
                      onClick={() => onAddPreset(source, category)}
                    >
                      <Plus className="h-3 w-3" />
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
    <Card variant="inset" className="space-y-4 p-4">
      <h3 className="text-label text-headline">Configure custom revenue channel</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Input
            value={newRevenue.name}
            onChange={(e) => setNewRevenue((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Revenue channel name (e.g. Carbon Levy)"
          />

          <Select
            value={newRevenue.category}
            onValueChange={(value: RevenueCategory) =>
              setNewRevenue((prev) => ({ ...prev, category: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {revenueCategories.map((category) => {
                const CategoryIcon = revenueCategoryIcons[category];
                return (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center">
                      <CategoryIcon className="text-label-secondary mr-2 h-4 w-4" />
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
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-label text-caption font-semibold">Collection method</Label>
          <Select
            value={newRevenue.collectionMethod || ""}
            onValueChange={(value) =>
              setNewRevenue((prev) => ({ ...prev, collectionMethod: value }))
            }
          >
            <SelectTrigger className="text-footnote">
              <SelectValue placeholder="Select collection method" />
            </SelectTrigger>
            <SelectContent>
              {getCollectionMethodsForCategory(newRevenue.category).map((method) => {
                const IconComponent = getCollectionMethodIcon(method.icon);
                return (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex items-center gap-2">
                      <IconComponent className="text-label-secondary h-4 w-4 shrink-0" />
                      <div className="flex flex-col text-left">
                        <span className="text-caption font-semibold">{method.name}</span>
                        <span className="text-label-secondary text-footnote">
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

        <div className="space-y-2">
          <Label className="text-label text-caption font-semibold">Administrative authority</Label>
          {availableDepartments.length > 0 ? (
            <Select
              value={newRevenue.administeredBy || ""}
              onValueChange={(value) =>
                setNewRevenue((prev) => ({ ...prev, administeredBy: value }))
              }
            >
              <SelectTrigger className="text-footnote">
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
              value={newRevenue.administeredBy || ""}
              onChange={(e) =>
                setNewRevenue((prev) => ({ ...prev, administeredBy: e.target.value }))
              }
              placeholder="Department or agency name"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-label text-caption font-semibold">Description</Label>
        <Input
          value={newRevenue.description || ""}
          onChange={(e) => setNewRevenue((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of this revenue source"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4" />
          Add channel
        </Button>
        <Button variant="outline" onClick={() => setIsAddingNew(false)} size="sm">
          Cancel
        </Button>
      </div>
    </Card>
  );
}
