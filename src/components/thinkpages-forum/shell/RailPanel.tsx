"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface RailPanelProps {
  title: string;
  icon: React.ReactNode;
  /** An anchor for the panel (`/thinkpages#standing`). */
  id?: string;
  children?: React.ReactNode;
}

/**
 * One panel of a forum page's rail: a data card with an icon title (a level 2 heading). Renders nothing when it has
 * no content. A pane in the desktop aside; a well inside the sheet the rail becomes below xl, whose overlay is glass.
 */
export function RailPanel({ title, icon, id, children }: RailPanelProps) {
  const [inSheet, setInSheet] = React.useState(false);
  // The surface is known only once the card is in the DOM; the ref callback runs before paint.
  const place = React.useCallback((element: HTMLDivElement | null) => {
    if (element) setInSheet(element.closest('[data-slot="sheet-content"]') !== null);
  }, []);
  if (React.Children.count(children) === 0) return null;
  return (
    <Card
      ref={place}
      content="data"
      variant={inSheet ? "well" : "pane"}
      padding="md"
      id={id}
      className="scroll-mt-24"
    >
      <CardHeader className="px-0 pb-3">
        <CardTitle icon={icon} role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body px-0">{children}</CardContent>
    </Card>
  );
}
