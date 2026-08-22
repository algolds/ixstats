import * as React from "react";
import { cn } from "~/lib/utils";

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Empty({ className, children, ...props }: EmptyProps) {
  return (
    <div
      className={cn(
        "flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center animate-in fade-in-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyMedia({
  className,
  children,
  variant: _variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) {
  return (
    <div
      className={cn(
        "mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn("text-sm font-semibold tracking-tight text-foreground", className)} {...props}>
      {children}
    </h4>
  );
}

export function EmptyDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted-foreground max-w-sm", className)} {...props}>
      {children}
    </p>
  );
}
