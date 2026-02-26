"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { ValidationCategory as ValidationCategoryType } from "~/lib/system-validation";
import { getStatusBgColor } from "~/lib/system-validation";
import { ValidationResult } from "./ValidationResult";

export const ValidationCategory = React.memo(function ValidationCategory({
  category,
}: {
  category: ValidationCategoryType;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const passed = category.checks.filter((c) => c.status === "pass").length;
  const warnings = category.checks.filter((c) => c.status === "warn").length;
  const failures = category.checks.filter((c) => c.status === "fail").length;

  const overallStatus = failures > 0 ? "fail" : warnings > 0 ? "warn" : "pass";

  return (
    <Card className={`border ${getStatusBgColor(overallStatus)} transition-all`}>
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-base">{category.category}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {passed > 0 && (
              <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 text-xs">
                {passed} passed
              </Badge>
            )}
            {warnings > 0 && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
                {warnings} warn
              </Badge>
            )}
            {failures > 0 && (
              <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                {failures} fail
              </Badge>
            )}
            <span className="text-muted-foreground text-xs ml-1">{category.duration}ms</span>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-0.5">
            {category.checks.map((check, i) => (
              <ValidationResult key={`${check.name}-${i}`} check={check} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
});
