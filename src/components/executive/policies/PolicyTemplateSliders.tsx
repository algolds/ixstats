"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import { ControlSlider as Sliders } from "iconoir-react";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

interface PolicyTemplateSlidersProps {
  currentTemplate: any;
  sliderSettings: Record<string, any>;
  onSliderChange: (key: string, value: any) => void;
}

export function PolicyTemplateSliders({
  currentTemplate,
  sliderSettings,
  onSliderChange,
}: PolicyTemplateSlidersProps) {
  if (!currentTemplate?.sliders?.length) return null;

  return (
    <div className="rounded-row bg-surface-secondary space-y-4 p-4">
      <h4 className="text-subhead text-label flex items-center gap-2">
        <Sliders className="text-label-secondary h-3.5 w-3.5" aria-hidden />
        Policy strategy configurations
      </h4>

      {currentTemplate.sliders.map((slider: any) => (
        <div key={slider.key} className="space-y-2">
          <Label className="text-label-secondary text-caption">{slider.label}</Label>
          <ToggleGroup
            type="single"
            disallowEmpty
            variant="outline"
            size="sm"
            aria-label={slider.label}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            value={String(sliderSettings[slider.key])}
            onValueChange={(v) => {
              const opt = slider.options.find((o: any) => String(o.value) === v);
              if (opt) onSliderChange(slider.key, opt.value);
            }}
          >
            {slider.options.map((opt: any) => (
              <ToggleGroupItem key={opt.label} value={String(opt.value)} className="h-auto py-2">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
    </div>
  );
}
