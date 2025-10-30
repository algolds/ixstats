/**
 * Template Modal Component
 *
 * Modal for selecting government templates
 */

import React from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import type { GovernmentTemplate } from '~/types/government';

export interface TemplateModalProps {
  templates: GovernmentTemplate[];
  onApplyTemplate: (template: GovernmentTemplate) => void;
  onClose: () => void;
}

export const TemplateModal = React.memo(function TemplateModal({
  templates,
  onApplyTemplate,
  onClose,
}: TemplateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Government Templates</h2>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template, index) => (
            <Card
              key={index}
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Badge variant="secondary">{template.governmentType}</Badge>
                    <Badge variant="outline" className="ml-2">
                      {template.departments.length} Departments
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <strong>Departments:</strong>
                    <ul className="mt-1 text-muted-foreground">
                      {template.departments.slice(0, 3).map((dept) => (
                        <li key={dept.name}>• {dept.name}</li>
                      ))}
                      {template.departments.length > 3 && (
                        <li>• +{template.departments.length - 3} more...</li>
                      )}
                    </ul>
                  </div>
                  <Button onClick={() => onApplyTemplate(template)} className="w-full">
                    Use This Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
});
