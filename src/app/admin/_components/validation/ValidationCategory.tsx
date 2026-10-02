"use client";

import React, { useState } from "react";
import { NavArrowDown as ChevronDown, NavArrowRight as ChevronRight } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { ValidationCategory as ValidationCategoryType } from "~/lib/system/system-validation";
import { getStatusBgColor } from "~/lib/system/system-validation";
import { ValidationResult } from "./ValidationResult";
import { cn } from "~/lib/utils/cn";

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
    <Card
      className={cn(
        "flex flex-col gap-6 py-6",
        `border ${getStatusBgColor(overallStatus)} transition-[color,background-color,border-color,box-shadow,opacity,transform]`
      )}
    >
      <CardHeader
        className="cursor-pointer pb-3 select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-label-secondary h-4 w-4" />
            ) : (
              <ChevronRight className="text-label-secondary h-4 w-4" />
            )}
            <CardTitle className="text-body">{category.category}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {passed > 0 && <Badge variant="green">{passed} passed</Badge>}
            {warnings > 0 && <Badge variant="yellow">{warnings} warn</Badge>}
            {failures > 0 && <Badge variant="red">{failures} fail</Badge>}
            <span className="text-label-secondary text-footnote ml-1">{category.duration}ms</span>
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
