"use client";

import { useState, type ReactNode } from "react";
import { WarningTriangle } from "iconoir-react";
import { Button } from "~/components/ui/button";

/**
 * A post's body, media and embeds behind its author's content warning: "CW: <reason>" and a "Show post" button,
 * pressed once per post and view (never stored). With no warning the children render as they are.
 */
export function ContentWarningGate({
  reason,
  children,
}: {
  reason?: string | null;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  if (!reason || shown) return <>{children}</>;

  return (
    <div className="bg-surface-secondary rounded-row mb-3 flex items-center gap-3 p-3">
      <WarningTriangle className="text-label-secondary size-4 shrink-0" aria-hidden="true" />
      <p className="text-callout text-label min-w-0 flex-1 break-words">CW: {reason}</p>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={(event) => {
          // The post card underneath opens the post on click.
          event.stopPropagation();
          setShown(true);
        }}
      >
        Show post
      </Button>
    </div>
  );
}
