import { Fragment } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CheckCircle as CheckCircle2,
  WarningTriangle as AlertTriangle,
  TaskList as ClipboardList,
} from "iconoir-react";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { ComplianceSectionStatus } from "~/hooks/useMyCountryCompliance";
import { Card } from "~/components/ui/card";

interface MyCountryComplianceModalProps {
  isOpen: boolean;
  sections: ComplianceSectionStatus[];
  onReview: () => void;
  onRemindLater: () => void;
  onDismiss?: () => void;
}

export function MyCountryComplianceModal({
  isOpen,
  sections,
  onReview,
  onRemindLater,
  onDismiss,
}: MyCountryComplianceModalProps) {
  const incompleteSections = sections.filter((section) => !section.isComplete);
  const allComplete = sections.length > 0 && incompleteSections.length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={(value) => !value && onDismiss?.()}>
      <SheetContent size="wide" className="overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 px-4 pt-4 text-left sm:px-6 sm:pt-6">
            <SheetTitle className="text-title-2 sm:text-title-1 flex items-center gap-2">
              <ClipboardList aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" />
              Complete your MyCountry profile
            </SheetTitle>
            <SheetDescription className="text-label-secondary text-body sm:text-body">
              Some profile sections are incomplete. Finish them to keep your national data accurate.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4 pb-2 sm:px-6">
            <div className="space-y-3 pb-4 sm:space-y-4">
              {sections.map((section) => (
                <Fragment key={section.id}>
                  <Card variant="well" padding="none" className="p-3 transition-colors sm:p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {section.isComplete ? (
                            <CheckCircle2 className="text-green h-4 w-4 sm:h-5 sm:w-5" />
                          ) : (
                            <AlertTriangle className="text-yellow h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                          <h3 className="text-label text-headline sm:text-headline">
                            {section.title}
                          </h3>
                        </div>
                        <p className="text-label-secondary text-footnote sm:text-body mt-1">
                          {section.description}
                        </p>
                      </div>
                      <Badge variant={section.isComplete ? "success" : "outline"}>
                        {section.isComplete ? "Complete" : "Action Needed"}
                      </Badge>
                    </div>

                    {!section.isComplete && section.missing.length > 0 && (
                      <ul className="text-label-secondary text-footnote sm:text-body mt-3 list-disc space-y-1 pl-4 sm:pl-6">
                        {section.missing.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Fragment>
              ))}
            </div>
          </ScrollArea>

          <SheetFooter className="border-separator bg-fill-4 shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              {!allComplete ? (
                <>
                  <Button
                    variant="outline"
                    onClick={onRemindLater}
                    className="text-body w-full sm:w-fit"
                  >
                    Remind me later
                  </Button>
                  <Button onClick={onReview} className="text-body w-full sm:w-fit">
                    Open MyCountry editor
                  </Button>
                </>
              ) : (
                <Button onClick={onDismiss} className="text-body w-full sm:w-fit">
                  Close
                </Button>
              )}
            </div>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
