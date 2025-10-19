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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-semibold">
            <ClipboardList className="h-6 w-6 text-primary" />
            Complete Your MyCountry Profile
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Ensure your nation is fully onboarded. Completing the sections below
            unlocks executive dashboards, accuracy scoring, and compliance
            automation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {sections.map((section) => (
            <Fragment key={section.id}>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {section.isComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                      <h3 className="font-semibold text-foreground">
                        {section.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <Badge
                    variant={section.isComplete ? "default" : "outline"}
                    className={
                      section.isComplete ? "bg-emerald-500 hover:bg-emerald-500" : ""
                    }
                  >
                    {section.isComplete ? "Complete" : "Action Needed"}
                  </Badge>
                </div>

                {!section.isComplete && section.missing.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                    {section.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Fragment>
          ))}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {!allComplete && (
            <>
              <Button
                variant="outline"
                onClick={onRemindLater}
                className="w-full sm:w-fit"
              >
                Remind me later
              </Button>
              <Button onClick={onReview} className="w-full sm:w-fit">
                Open MyCountry Editor
              </Button>
            </>
          )}
          {allComplete && (
            <Button onClick={onDismiss} className="w-full sm:w-fit">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
