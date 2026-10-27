"use client";

import type { ComponentType } from "react";
import { Card } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { StudioCalibrationTab } from "./StudioCalibrationTab";
import { StudioLayersTab } from "./StudioLayersTab";
import { StudioPresetsTab } from "./StudioPresetsTab";
import { StudioShipTab } from "./StudioShipTab";

const TABS: ReadonlyArray<{ value: string; label: string; Panel: ComponentType }> = [
  { value: "layers", label: "Layers", Panel: StudioLayersTab },
  { value: "calibration", label: "Calibration", Panel: StudioCalibrationTab },
  { value: "presets", label: "Presets", Panel: StudioPresetsTab },
  { value: "ship", label: "Ship", Panel: StudioShipTab },
];

/** The right-hand inspector: Layers, Calibration, Presets and Ship. Each panel reads `useStudio()`. */
export function StudioInspector() {
  return (
    <Card content="input" padding="none" className="flex min-h-0 flex-col overflow-hidden">
      <Tabs defaultValue="layers" className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Inspector" className="border-separator shrink-0 gap-1 border-b p-2">
          {TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="text-footnote px-3 py-2">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, Panel }) => (
          <TabsContent key={value} value={value} className="min-h-0 flex-1 overflow-y-auto">
            <Panel />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
