"use client";
/**
 * Template Selector
 *
 * Quick selection of preset economic configurations.
 * Optimized with React.memo for performance.
 */

import React from "react";
import { Button } from "~/components/ui/button";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Page as FileText } from "iconoir-react";
import type { EconomicTemplate } from "~/lib/economy/atomic-data";

export interface TemplateSelectorProps {
  templates: EconomicTemplate[];
  onLoadTemplate: (templateId: string) => void;
  disabled?: boolean;
}

/**
 * Template Selector Component
 */
function TemplateSelectorComponent({
  templates,
  onLoadTemplate,
  disabled = false,
}: TemplateSelectorProps) {
  return (
    <FacetCard className="rounded-card">
      <FacetCardHeader className="flex-row items-center gap-2 p-4 pb-3">
        <FileText aria-hidden="true" className="text-label-secondary h-4 w-4" />
        <h3 className="text-label text-headline">Quick start templates</h3>
      </FacetCardHeader>
      <FacetCardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {templates.map((template) => {
            const Icon = template.icon;

            return (
              <Button
                key={template.id}
                variant="outline"
                size="sm"
                onClick={() => onLoadTemplate(template.id)}
                disabled={disabled}
                className="flex h-auto flex-col items-center gap-2 py-3"
              >
                <Icon aria-hidden="true" className="text-label-secondary h-5 w-5" />
                <div className="text-center">
                  <div className="text-caption">{template.name}</div>
                  <div className="text-label-secondary text-footnote mt-1">
                    {template.components.length} components
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </FacetCardContent>
    </FacetCard>
  );
}

export const TemplateSelector = React.memo(TemplateSelectorComponent);
