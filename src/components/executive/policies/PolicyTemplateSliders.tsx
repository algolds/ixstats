"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import { ControlSlider as Sliders } from "iconoir-react";

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
    <div className="space-y-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-indigo-400 uppercase">
        <Sliders className="h-3.5 w-3.5" />
        Policy Strategy Configurations
      </h4>

      {currentTemplate.sliders.map((slider: any) => (
        <div key={slider.key} className="space-y-2">
          <Label className="text-muted-foreground text-xs font-medium">
            {slider.label}
          </Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {slider.options.map((opt: any) => {
              const isSelected = sliderSettings[slider.key] === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onSliderChange(slider.key, opt.value)}
                  className={`flex flex-col items-center justify-center rounded-md border p-2 text-center transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-600 font-medium text-white shadow-sm shadow-indigo-600/20"
                      : "bg-muted/40 border-border/40 hover:bg-muted/80 text-muted-foreground text-xs"
                  }`}
                >
                  <span className="text-center text-[10px] sm:text-xs">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
