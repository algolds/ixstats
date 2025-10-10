"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
} from "lucide-react";
import {
  calculateChangeImpact,
  getDelayDescription,
  getImpactColor,
  getImpactBgColor,
  type ChangeImpact,
} from "~/lib/change-impact-calculator";

export interface PendingChange {
  fieldPath: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  category: string;
}

interface ChangePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: PendingChange[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ChangePreviewDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  onCancel,
  isLoading = false,
}: ChangePreviewDialogProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Calculate impacts for all changes
  const changeImpacts: Array<PendingChange & { impact: ChangeImpact }> = changes.map(
    (change) => ({
      ...change,
      impact: calculateChangeImpact(change.fieldPath, change.oldValue, change.newValue),
    })
  );

  // Group changes by impact level
  const instantChanges = changeImpacts.filter((c) => c.impact.changeType === "instant");
  const nextDayChanges = changeImpacts.filter((c) => c.impact.changeType === "next_day");
  const shortTermChanges = changeImpacts.filter((c) => c.impact.changeType === "short_term");
  const longTermChanges = changeImpacts.filter((c) => c.impact.changeType === "long_term");

  const hasHighImpact = changeImpacts.some((c) => c.impact.impactLevel === "high");
  const hasMediumImpact = changeImpacts.some((c) => c.impact.impactLevel === "medium");

  function formatValue(value: unknown): string {
    if (typeof value === "number") {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    return String(value);
  }

  function renderChangeGroup(
    title: string,
    icon: React.ReactNode,
    description: string,
    groupChanges: typeof changeImpacts,
    color: string
  ) {
    if (groupChanges.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className={`font-semibold ${color}`}>{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {groupChanges.length} {groupChanges.length === 1 ? "change" : "changes"}
          </Badge>
        </div>

        <div className="space-y-2">
          {groupChanges.map((change, index) => {
            const globalIndex = changeImpacts.indexOf(change);
            const isExpanded = expandedIndex === globalIndex;

            return (
              <motion.div
                key={globalIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-lg border p-3 ${getImpactBgColor(change.impact.impactLevel)} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => setExpandedIndex(isExpanded ? null : globalIndex)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{change.fieldLabel}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getImpactColor(change.impact.impactLevel)}`}
                      >
                        {change.impact.impactLevel} impact
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="line-through">{formatValue(change.oldValue)}</span>
                      <span>→</span>
                      <span className="font-semibold text-foreground">
                        {formatValue(change.newValue)}
                      </span>
                    </div>
                  </div>
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t space-y-2"
                    >
                      {change.impact.warnings.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">Warnings:</p>
                          {change.impact.warnings.map((warning, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex gap-2">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}
                      {change.impact.reasons.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">Why the delay?</p>
                          {change.impact.reasons.map((reason, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex gap-2">
                              <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
                              {reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            Review Your Changes
          </DialogTitle>
          <DialogDescription>
            Changes will take effect based on their economic impact. Click any change to see details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Impact Summary */}
          {(hasHighImpact || hasMediumImpact) && (
            <Alert variant={hasHighImpact ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {hasHighImpact && (
                  <p className="font-semibold">
                    High-impact changes detected! These changes will take 7 days game time (3.5 days real time) to implement.
                  </p>
                )}
                {hasMediumImpact && !hasHighImpact && (
                  <p className="font-semibold">
                    Medium-impact changes detected! These changes will take 3-5 days game time (1.5-2.5 days real time) to implement.
                  </p>
                )}
                <p className="text-sm mt-1">
                  Your country's economy needs time to adjust to major policy changes.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Instant Changes */}
          {renderChangeGroup(
            "Instant Changes",
            <Zap className="h-5 w-5 text-green-500" />,
            "Applied immediately",
            instantChanges,
            "text-green-600 dark:text-green-400"
          )}

          {instantChanges.length > 0 && nextDayChanges.length > 0 && <Separator />}

          {/* Next Day Changes */}
          {renderChangeGroup(
            "Next Day (12 hrs real time)",
            <Clock className="h-5 w-5 text-blue-500" />,
            "Takes effect tomorrow",
            nextDayChanges,
            "text-blue-600 dark:text-blue-400"
          )}

          {nextDayChanges.length > 0 && shortTermChanges.length > 0 && <Separator />}

          {/* Short Term Changes */}
          {renderChangeGroup(
            "Short Term (3-5 days game / 1.5-2.5 days real)",
            <TrendingUp className="h-5 w-5 text-yellow-500" />,
            "Moderate policy implementation time",
            shortTermChanges,
            "text-yellow-600 dark:text-yellow-400"
          )}

          {shortTermChanges.length > 0 && longTermChanges.length > 0 && <Separator />}

          {/* Long Term Changes */}
          {renderChangeGroup(
            "Long Term (7 days game / 3.5 days real)",
            <TrendingDown className="h-5 w-5 text-red-500" />,
            "Major structural changes require time",
            longTermChanges,
            "text-red-600 dark:text-red-400"
          )}

          {/* Info box */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Why delays?</strong> Major economic changes require time for markets, businesses,
              and citizens to adjust. This simulates realistic policy implementation timelines.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <CheckCircle className="h-4 w-4" />
                </motion.div>
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm All Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
