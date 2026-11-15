import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

/**
 * A titled section panel for the drill sheets and the full-page domain surfaces. It is always
 * opaque inside a sheet so blur never stacks.
 */
export function SheetSection({
  title,
  icon: Icon,
  accessory,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accessory?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("rounded-card", className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <CardTitle icon={<Icon />} role="heading" aria-level={3} className="min-w-0">
          {title}
        </CardTitle>
        {accessory}
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}
