import * as React from "react";
import { cn } from "~/lib/utils/cn";

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Empty({ className, children, ...props }: EmptyProps) {
  return (
    <div
      className={cn(
        "border-border/60 animate-in fade-in-50 flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
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
        "bg-muted text-muted-foreground mb-2 flex h-10 w-10 items-center justify-center rounded-full",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn("text-foreground text-sm font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h4>
  );
}

export function EmptyDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-muted-foreground max-w-sm text-xs", className)} {...props}>
      {children}
    </p>
  );
}
