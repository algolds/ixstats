"use client";

import { ControlSlider as Sliders } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import type { PREDEFINED_DECRETALS } from "~/lib/policies/registry";

type PolicyTemplate = (typeof PREDEFINED_DECRETALS)[string];

interface PolicyTemplateSlidersProps {
  currentTemplate: PolicyTemplate | null | undefined;
  sliderSettings: Record<string, number>;
  onSliderChange: (key: string, value: number) => void;
}

export function PolicyTemplateSliders({
  currentTemplate,
  sliderSettings,
  onSliderChange,
}: PolicyTemplateSlidersProps) {
  if (!currentTemplate?.sliders?.length) return null;

  return (
    <Card variant="well" padding="md" className="space-y-4">
      <h4 className="text-subhead text-label flex items-center gap-2">
        <Sliders className="text-label-secondary h-3.5 w-3.5" aria-hidden />
        Strategy options
      </h4>

      {currentTemplate.sliders.map((slider) => (
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
              const opt = slider.options.find((o) => String(o.value) === v);
              if (opt) onSliderChange(slider.key, opt.value);
            }}
          >
            {slider.options.map((opt) => (
              <ToggleGroupItem key={opt.label} value={String(opt.value)} className="h-auto py-2">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
    </Card>
  );
}
