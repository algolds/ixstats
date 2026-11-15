import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  CheckCircle as CheckCircle2,
  WarningTriangle as AlertTriangle,
  TaskList as ClipboardList,
} from "iconoir-react";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { ComplianceSectionStatus } from "~/hooks/useMyCountryCompliance";

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
              <ClipboardList aria-hidden="true" className="text-tint h-5 w-5 sm:h-6 sm:w-6" />
              Complete your MyCountry profile
            </SheetTitle>
            <SheetDescription className="text-label-secondary text-body">
              Some profile sections are incomplete. Finish them to keep your national data accurate.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4 pb-2 sm:px-6">
            <div className="pb-4">
              <FacetList>
                <FacetListSection>
                  {sections.map((section) => {
                    const missingNote =
                      !section.isComplete && section.missing.length > 0
                        ? `Missing: ${section.missing.join(", ")}`
                        : null;
                    return (
                      <FacetRow
                        key={section.id}
                        leading={
                          section.isComplete ? (
                            <CheckCircle2
                              aria-hidden="true"
                              className="text-success size-4 shrink-0"
                            />
                          ) : (
                            <AlertTriangle
                              aria-hidden="true"
                              className="text-warning size-4 shrink-0"
                            />
                          )
                        }
                        title={section.title}
                        subtitle={
                          <span className="flex flex-col gap-0.5 whitespace-normal">
                            <span>{section.description}</span>
                            {missingNote && (
                              <span className="text-label text-footnote">{missingNote}</span>
                            )}
                          </span>
                        }
                        trailing={
                          <span
                            className={
                              section.isComplete
                                ? "text-success text-footnote font-medium"
                                : "text-warning-ink text-footnote font-medium"
                            }
                          >
                            {section.isComplete ? "Complete" : "Action needed"}
                          </span>
                        }
                      />
                    );
                  })}
                </FacetListSection>
              </FacetList>
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
                    Review
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
