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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden p-0">
        <div className="flex h-full flex-col min-h-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 text-left flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Complete Your MyCountry Profile
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground">
              Ensure your nation is fully onboarded. Completing the sections
              below unlocks executive dashboards, accuracy scoring, and
              compliance automation.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 sm:px-6 pb-2 max-h-[calc(90vh-12rem)] sm:max-h-[calc(85vh-12rem)]">
            <div className="space-y-3 sm:space-y-4 pb-4">
              {sections.map((section) => (
                <Fragment key={section.id}>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 transition-colors">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {section.isComplete ? (
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                          )}
                          <h3 className="font-semibold text-foreground text-sm sm:text-base">
                            {section.title}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                      <Badge
                        variant={section.isComplete ? "default" : "outline"}
                        className={
                          section.isComplete
                            ? "bg-emerald-500 hover:bg-emerald-500 text-xs sm:text-sm"
                            : "text-xs sm:text-sm"
                        }
                      >
                        {section.isComplete ? "Complete" : "Action Needed"}
                      </Badge>
                    </div>

                    {!section.isComplete && section.missing.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-4 sm:pl-6 text-xs sm:text-sm text-muted-foreground">
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

          <DialogFooter className="border-t border-border/60 bg-muted/20 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              {!allComplete ? (
                <>
                  <Button
                    variant="outline"
                    onClick={onRemindLater}
                    className="w-full sm:w-fit text-sm"
                  >
                    Remind me later
                  </Button>
                  <Button onClick={onReview} className="w-full sm:w-fit text-sm">
                    Open MyCountry Editor
                  </Button>
                </>
              ) : (
                <Button onClick={onDismiss} className="w-full sm:w-fit text-sm">
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
