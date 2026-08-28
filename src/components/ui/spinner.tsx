import * as React from "react";
import { SystemRestart as Loader2 } from "iconoir-react";
import { cn } from "~/lib/utils/cn";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
}

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Loader2 className={cn("text-muted-foreground h-4 w-4 animate-spin", className)} {...props} />
  );
}
