import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface RailPanelProps {
  title: string;
  icon: React.ReactNode;
  /** An anchor for the panel (`/thinkpages#standing`). */
  id?: string;
  children?: React.ReactNode;
}

/** One panel of a forum page's rail: a data pane with an icon title (a level 2 heading). Renders nothing when it has no content. */
export function RailPanel({ title, icon, id, children }: RailPanelProps) {
  if (React.Children.count(children) === 0) return null;
  return (
    <Card content="data" padding="md" id={id} className="scroll-mt-24">
      <CardHeader className="px-0 pb-3">
        <CardTitle icon={icon} role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body px-0">{children}</CardContent>
    </Card>
  );
}
