/**
 * Template Selector
 *
 * Quick selection of preset economic configurations.
 * Optimized with React.memo for performance.
 */

'use client';

import React from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { FileText } from 'lucide-react';
import type { EconomicTemplate } from '~/lib/atomic-economic-data';

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
  disabled = false
}: TemplateSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Quick Start Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {templates.map((template) => {
            const Icon = template.icon;

            return (
              <Button
                key={template.id}
                variant="outline"
                size="sm"
                onClick={() => onLoadTemplate(template.id)}
                disabled={disabled}
                className="flex flex-col items-center gap-2 h-auto py-3"
              >
                <Icon className="w-5 h-5" />
                <div className="text-center">
                  <div className="text-xs font-medium">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {template.components.length} components
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export const TemplateSelector = React.memo(TemplateSelectorComponent);
