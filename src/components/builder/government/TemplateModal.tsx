/**
 * Template Modal Component
 *
 * Modal for selecting government templates
 */

import React from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { GovernmentTemplate } from "~/types/government";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="bg-background border-border mx-4 max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg border p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-foreground text-2xl font-semibold">Government Templates</h2>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template, index) => (
            <Card key={index} className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                <p className="text-muted-foreground text-sm">{template.description}</p>
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
                    <ul className="text-muted-foreground mt-1">
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
