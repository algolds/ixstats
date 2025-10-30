/**
 * Template Selector
 *
 * Dropdown to select preset government templates.
 * Optimized with React.memo for performance.
 *
 * @module TemplateSelector
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { FileText } from 'lucide-react';
import { ComponentType } from '@prisma/client';

export interface GovernmentTemplate {
  name: string;
  description: string;
  components: readonly ComponentType[];
}

export interface TemplateSelectorProps {
  templates: Record<string, GovernmentTemplate>;
  onSelect: (templateId: string) => void;
  disabled?: boolean;
}

/**
 * Select preset government templates
 */
export const TemplateSelector = React.memo<TemplateSelectorProps>(
  ({ templates, onSelect, disabled = false }) => {
    const templateEntries = Object.entries(templates);

    if (templateEntries.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Select onValueChange={onSelect} disabled={disabled}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Load Template..." />
          </SelectTrigger>
          <SelectContent>
            {templateEntries.map(([id, template]) => (
              <SelectItem key={id} value={id}>
                <div className="flex flex-col gap-1 py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {template.components.length} components
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {template.description}
                  </p>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
);

TemplateSelector.displayName = 'TemplateSelector';
