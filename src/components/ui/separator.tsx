import * as React from "react";
import { cn } from "~/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, role, ...props }, ref) => {
    const isHorizontal = orientation === "horizontal";
    return (
      <div
        ref={ref}
        data-slot="separator"
        data-orientation={orientation}
        role={decorative ? "none" : (role ?? "separator")}
        aria-orientation={decorative ? undefined : orientation}
        className={cn(
          "bg-border shrink-0",
          isHorizontal ? "h-px w-full" : "h-full w-px",
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";

export { Separator };
