"use client";
// src/app/admin/economic-archetypes/_components/EconomicArchetypeFormDialog.tsx

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import {
  Trophy as Award,
  StatUp as TrendingUp,
  City as Building2,
  Dollar as DollarSign,
  Group as Users,
  Activity,
} from "iconoir-react";

import {
  type ArchetypeFormData,
  type ArchetypeEra,
  COMPLEXITY_LEVELS,
  SECTOR_TYPES,
  ECONOMIC_COMPONENTS,
  GOVERNMENT_COMPONENTS,
} from "./archetype-form-types";

import {
  GeneralTab,
  EconomicsTab,
  GovernmentTab,
  TaxTab,
  EmploymentTab,
  MetricsTab,
  CharacteristicsTab,
} from "./ArchetypeFormTabs";

export type { ArchetypeFormData, ArchetypeEra };
export { COMPLEXITY_LEVELS, SECTOR_TYPES, ECONOMIC_COMPONENTS, GOVERNMENT_COMPONENTS };

interface ArchetypeEditorDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ArchetypeFormData;
  setFormData: React.Dispatch<React.SetStateAction<ArchetypeFormData>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

const TABS = [
  { id: "general", label: "General", icon: Award },
  { id: "economics", label: "Economics", icon: TrendingUp },
  { id: "government", label: "Government", icon: Building2 },
  { id: "tax", label: "Tax system", icon: DollarSign },
  { id: "employment", label: "Employment", icon: Users },
  { id: "metrics", label: "Metrics", icon: Activity },
  { id: "characteristics", label: "Characteristics", icon: Award },
] as const;

export function EconomicArchetypeFormDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  activeTab,
  setActiveTab,
  onClose,
  onSave,
  isPending,
}: ArchetypeEditorDialogProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent size="wide" className="flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Archetype" : "Add Archetype"}</SheetTitle>
          <SheetDescription>Configure the economic archetype template</SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="border-separator flex shrink-0 gap-2 overflow-x-auto border-b pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="text-footnote">
                  <Icon className="mr-2 inline h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <TabsContent value="general">
              <GeneralTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="economics">
              <EconomicsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="government">
              <GovernmentTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="tax">
              <TaxTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="employment">
              <EmploymentTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="metrics">
              <MetricsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="characteristics">
              <CharacteristicsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
          </div>
        </Tabs>

        <SheetFooter className="border-separator shrink-0 border-t pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!formData.name || !formData.key || isPending}>
            {isPending ? "Saving..." : isEditing ? "Update Archetype" : "Create Archetype"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
