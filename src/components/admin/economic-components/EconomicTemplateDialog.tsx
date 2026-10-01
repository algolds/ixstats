"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Page as FileText } from "iconoir-react";
import { Badge } from "~/components/ui/badge";

interface EconomicTemplate {
  id: string;
  name: string;
  description: string;
  components: readonly string[];
}

interface EconomicTemplateDialogProps {
  isOpen: boolean;
  templates: readonly EconomicTemplate[];
  onClose: () => void;
}

export function EconomicTemplateDialog({
  isOpen,
  templates,
  onClose,
}: EconomicTemplateDialogProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent size="wide" className="flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Economic Templates</SheetTitle>
          <SheetDescription>
            Preset component sets players can load in the economy builder (defined in code)
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="text-yellow h-5 w-5" />
                  <h3 className="text-label font-semibold">{template.name}</h3>
                </div>

                <p className="text-body text-label-secondary mb-3">{template.description}</p>

                <div className="mb-3 space-y-2">
                  <div className="text-footnote flex items-center justify-between">
                    <span className="text-label-secondary">Components:</span>
                    <span className="text-label font-medium">{template.components.length}</span>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1">
                  {template.components.slice(0, 4).map((comp) => (
                    <Badge key={comp} variant="gray">
                      {comp.split("_").slice(0, 2).join(" ")}...
                    </Badge>
                  ))}
                  {template.components.length > 4 && (
                    <Badge variant="gray">+{template.components.length - 4} more</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <SheetFooter className="border-separator border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
