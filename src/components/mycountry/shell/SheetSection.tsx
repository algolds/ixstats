import React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

/**
 * A titled section panel for the drill sheets and the full-page domain surfaces. It is always
 * opaque so blur never stacks inside the (blurred) sheet.
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
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
          <h3 className="text-label text-headline">{title}</h3>
        </div>
        {accessory}
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}
