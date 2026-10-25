"use client";

import React from "react";
import { Signal } from "~/components/ui/signal";
import type { BudgetWarning } from "~/lib/military/model";
import { WARNING_COPY } from "../defense-copy";

/** The model's budget warnings, each with what to do about it. One signal for the section. */
export const DefenseWarnings = React.memo(function DefenseWarnings({
  warnings,
}: {
  warnings: readonly BudgetWarning[];
}) {
  if (warnings.length === 0) return null;
  const [first] = warnings;
  const title =
    warnings.length === 1 ? WARNING_COPY[first!].title : `${warnings.length} problems in the defense budget`;
  return (
    <Signal tone="warning" title={title}>
      {warnings.length === 1 ? (
        <p>{WARNING_COPY[first!].advice}</p>
      ) : (
        <ul className="space-y-2">
          {warnings.map((warning) => (
            <li key={warning}>
              <span className="text-label">{WARNING_COPY[warning].title}.</span>{" "}
              {WARNING_COPY[warning].advice}
            </li>
          ))}
        </ul>
      )}
    </Signal>
  );
});
