"use client";

import React, { useState } from "react";
import { NavArrowDown as ChevronDown, NavArrowRight as ChevronRight } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { ValidationCategory as ValidationCategoryType } from "~/lib/system/system-validation";
import { getStatusBgColor } from "~/lib/system/system-validation";
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
        className="cursor-pointer pb-3 select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
            <CardTitle className="text-base">{category.category}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {passed > 0 && (
              <Badge
                variant="outline"
                className="border-green-500/30 bg-green-500/10 text-xs text-green-400"
              >
                {passed} passed
              </Badge>
            )}
            {warnings > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-400"
              >
                {warnings} warn
              </Badge>
            )}
            {failures > 0 && (
              <Badge
                variant="outline"
                className="border-red-500/30 bg-red-500/10 text-xs text-red-400"
              >
                {failures} fail
              </Badge>
            )}
            <span className="text-muted-foreground ml-1 text-xs">{category.duration}ms</span>
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
