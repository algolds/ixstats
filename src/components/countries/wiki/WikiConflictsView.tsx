/**
 * Wiki Conflicts View Component
 *
 * Displays data integrity analysis showing conflicts between Wiki and IxStats data.
 * Highlights discrepancies with severity-based styling and provides clear comparison
 * of conflicting values.
 *
 * Features:
 * - Severity-based visual styling (high/medium/low)
 * - Side-by-side value comparison
 * - Empty state for no conflicts
 * - Color-coded borders for quick severity identification
 *
 * @component
 */

import React from "react";
import { RiShieldLine } from "react-icons/ri";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { type DataConflict } from "~/types/wiki-intelligence";

/**
 * Props for WikiConflictsView component
 */
interface WikiConflictsViewProps {
  /** Array of detected data conflicts between Wiki and IxStats */
  dataConflicts: DataConflict[];
}

/**
 * WikiConflictsView Component
 *
 * Renders data integrity analysis showing conflicts between Wiki and IxStats data.
 * When conflicts exist, displays them with severity-based styling and value comparisons.
 * When no conflicts exist, shows a confirmation message.
 *
 * @param props - Component props
 * @returns React component displaying data conflicts or integrity confirmation
 */
export function WikiConflictsView({ dataConflicts }: WikiConflictsViewProps) {
  return (
    <div className="space-y-6">
      {dataConflicts.length > 0 ? (
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiShieldLine className="h-5 w-5 text-orange-400" />
              Data Intelligence Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dataConflicts.map((conflict, index) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-lg border-l-4 p-4",
                    conflict.severity === "high" && "border-red-500 bg-red-500/10",
                    conflict.severity === "medium" && "border-yellow-500 bg-yellow-500/10",
                    conflict.severity === "low" && "border-blue-500 bg-blue-500/10"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{conflict.field} Discrepancy</h4>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Wiki:</span>
                          <span>{conflict.wikiValue || "Not specified"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">IxStats:</span>
                          <span>{conflict.ixStatsValue || "Not specified"}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-4",
                        conflict.severity === "high" && "border-red-500/30 text-red-400",
                        conflict.severity === "medium" && "border-yellow-500/30 text-yellow-400",
                        conflict.severity === "low" && "border-blue-500/30 text-blue-400"
                      )}
                    >
                      {conflict.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-hierarchy-child">
          <CardContent className="p-8 text-center">
            <RiShieldLine className="mx-auto mb-4 h-12 w-12 text-green-400" />
            <h3 className="mb-2 text-lg font-semibold">Data Integrity Confirmed</h3>
            <p className="text-muted-foreground">
              No significant conflicts detected between Wiki and IxStats data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
