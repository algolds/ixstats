"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FileText, Pencil, Activity, Plus } from "lucide-react";

interface EconomicTemplateDialogProps {
  isOpen: boolean;
  templates: any[];
  onClose: () => void;
}

export function EconomicTemplateDialog({
  isOpen,
  templates,
  onClose,
}: EconomicTemplateDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Economic Templates</DialogTitle>
          <DialogDescription>
            Pre-configured economic component sets for common economic models
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template, idx) => (
              <Card key={idx} className="glass-card-child p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[--intel-gold]" />
                    <h3 className="text-foreground font-semibold">{template.name}</h3>
                  </div>
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                    {template.targetTier}
                  </span>
                </div>

                <p className="mb-3 text-sm text-[--intel-silver]">{template.description}</p>

                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[--intel-silver]">Components:</span>
                    <span className="text-foreground font-medium">
                      {template.components.length}
                    </span>
                  </div>
                  <div className="text-xs text-[--intel-silver]">
                    <strong>Outcome:</strong> {template.expectedOutcome}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1">
                  {template.components.slice(0, 4).map((comp: string, i: number) => (
                    <span
                      key={i}
                      className="rounded bg-white/5 px-2 py-0.5 text-xs text-[--intel-silver]"
                    >
                      {comp.split("_").slice(0, 2).join(" ")}...
                    </span>
                  ))}
                  {template.components.length > 4 && (
                    <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[--intel-silver]">
                      +{template.components.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs">
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs">
                    <Activity className="mr-1 h-3 w-3" />
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-white/10 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
