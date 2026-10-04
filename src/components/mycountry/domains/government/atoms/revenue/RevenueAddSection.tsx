"use client";

import React, { useState } from "react";
import { Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Eyebrow } from "~/components/ui/eyebrow";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import { revenueCategories, revenueCategoryIcons, commonRevenueSources } from "./revenueConstants";
import {
  AdministeredBySelect,
  CollectionMethodSelect,
  RevenueCategorySelect,
} from "./RevenueSelects";
import { Card } from "~/components/ui/card";

interface RevenueAddSectionProps {
  onAddCustom: (newRevenue: RevenueSourceInput) => void;
  onAddPreset: (name: string, category: RevenueCategory) => void;
  availableDepartments?: { id: string; name: string }[];
}

const EMPTY_REVENUE: RevenueSourceInput = {
  name: "",
  category: "Direct Tax",
  description: "",
  rate: 0,
  revenueAmount: 0,
  collectionMethod: "",
  administeredBy: "",
};

export function RevenueAddSection({
  onAddCustom,
  onAddPreset,
  availableDepartments = [],
}: RevenueAddSectionProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRevenue, setNewRevenue] = useState<RevenueSourceInput>(EMPTY_REVENUE);

  const handleAdd = () => {
    if (newRevenue.name.trim()) {
      onAddCustom(newRevenue);
      setNewRevenue(EMPTY_REVENUE);
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
    <Card variant="well" className="space-y-4 p-4">
      <h3 className="text-label text-headline">Configure custom revenue channel</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Input
            value={newRevenue.name}
            onChange={(e) => setNewRevenue((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Revenue channel name (e.g. Carbon Levy)"
          />

          <RevenueCategorySelect
            value={newRevenue.category}
            onChange={(category) => setNewRevenue((prev) => ({ ...prev, category }))}
          />
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
          <CollectionMethodSelect
            category={newRevenue.category}
            value={newRevenue.collectionMethod || ""}
            onChange={(collectionMethod) =>
              setNewRevenue((prev) => ({ ...prev, collectionMethod }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-label text-caption font-semibold">Administrative authority</Label>
          <AdministeredBySelect
            value={newRevenue.administeredBy || ""}
            onChange={(administeredBy) => setNewRevenue((prev) => ({ ...prev, administeredBy }))}
            departments={availableDepartments}
            placeholder="Department or agency name"
          />
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
