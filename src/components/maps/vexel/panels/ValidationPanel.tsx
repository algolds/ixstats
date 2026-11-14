"use client";

import { CheckCircle, WarningCircle, WarningTriangle } from "iconoir-react";
import { Card, CardTitle } from "~/components/ui/card";
import { useVexelEditor } from "../VexelEditorProvider";

/** The rule of tincture and the other heraldic rules the design breaks, if any. */
export default function ValidationPanel() {
  const { validationWarnings } = useVexelEditor();
  const clean = validationWarnings.length === 0;

  return (
    <Card padding="md" content="feed" className="space-y-3">
      <CardTitle icon={clean ? <CheckCircle /> : <WarningTriangle />}>Heraldic rules</CardTitle>
      {clean ? (
        <p className="text-callout text-success-ink">Follows the rule of tincture.</p>
      ) : (
        <ul className="space-y-3">
          {validationWarnings.map((warn, idx) => {
            const caution = warn.severity === "caution";
            const Icon = caution ? WarningCircle : WarningTriangle;
            return (
              <li key={idx} className="flex items-start gap-2">
                <Icon
                  aria-label={caution ? "Caution" : "Note"}
                  className={`mt-0.5 size-4 shrink-0 ${caution ? "text-destructive" : "text-warning"}`}
                />
                <p className="text-callout text-label">{warn.message}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
