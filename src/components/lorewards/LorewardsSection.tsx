import { useId, type ReactNode } from "react";
import { Card } from "~/components/ui/card";

interface LorewardsSectionProps {
  /** The heading, which also names the region. */
  title: string;
  children: ReactNode;
  /** A control or link at the end of the heading row. */
  action?: ReactNode;
  content?: "data" | "feed" | "collectible";
}

/** A titled pane of the Lorewards view. */
export function LorewardsSection({
  title,
  children,
  action,
  content = "data",
}: LorewardsSectionProps) {
  const headingId = useId();
  return (
    <Card
      content={content}
      padding="md"
      role="region"
      aria-labelledby={headingId}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-headline text-label">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}
