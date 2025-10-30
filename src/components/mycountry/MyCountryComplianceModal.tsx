import { Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CheckCircle2, AlertTriangle, ClipboardList } from "lucide-react";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { ComplianceSectionStatus } from "~/hooks/useMyCountryCompliance";

interface MyCountryComplianceModalProps {
  open: boolean;
  sections: ComplianceSectionStatus[];
  onReview: () => void;
  onRemindLater: () => void;
  onDismiss?: () => void;
}

export function MyCountryComplianceModal({
  open,
  sections,
  onReview,
  onRemindLater,
  onDismiss,
}: MyCountryComplianceModalProps) {
  const incompleteSections = sections.filter((section) => !section.isComplete);
  const allComplete = sections.length > 0 && incompleteSections.length === 0;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onDismiss?.()}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-3xl">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="flex-shrink-0 px-4 pt-4 text-left sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
              <ClipboardList className="text-primary h-5 w-5 sm:h-6 sm:w-6" />
              Complete Your MyCountry Profile
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm sm:text-base">
              Ensure your nation is fully onboarded. Completing the sections below unlocks executive
              dashboards, accuracy scoring, and compliance automation.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-12rem)] flex-1 px-4 pb-2 sm:max-h-[calc(85vh-12rem)] sm:px-6">
            <div className="space-y-3 pb-4 sm:space-y-4">
              {sections.map((section) => (
                <Fragment key={section.id}>
                  <div className="border-border bg-muted/30 rounded-lg border p-3 transition-colors sm:p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {section.isComplete ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 sm:h-5 sm:w-5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 sm:h-5 sm:w-5" />
                          )}
                          <h3 className="text-foreground text-sm font-semibold sm:text-base">
                            {section.title}
                          </h3>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                          {section.description}
                        </p>
                      </div>
                      <Badge
                        variant={section.isComplete ? "default" : "outline"}
                        className={
                          section.isComplete
                            ? "bg-emerald-500 text-xs hover:bg-emerald-500 sm:text-sm"
                            : "text-xs sm:text-sm"
                        }
                      >
                        {section.isComplete ? "Complete" : "Action Needed"}
                      </Badge>
                    </div>

                    {!section.isComplete && section.missing.length > 0 && (
                      <ul className="text-muted-foreground mt-3 list-disc space-y-1 pl-4 text-xs sm:pl-6 sm:text-sm">
                        {section.missing.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="border-border/60 bg-muted/20 flex-shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              {!allComplete ? (
                <>
                  <Button
                    variant="outline"
                    onClick={onRemindLater}
                    className="w-full text-sm sm:w-fit"
                  >
                    Remind me later
                  </Button>
                  <Button onClick={onReview} className="w-full text-sm sm:w-fit">
                    Open MyCountry Editor
                  </Button>
                </>
              ) : (
                <Button onClick={onDismiss} className="w-full text-sm sm:w-fit">
                  Close
                </Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
