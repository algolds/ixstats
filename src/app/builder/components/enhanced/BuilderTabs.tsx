"use client";

import React from "react";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface EnhancedTabsListProps extends React.ComponentProps<typeof TabsList> {}

export function EnhancedTabsList({ children, className, ...props }: EnhancedTabsListProps) {
  return (
    <TabsList
      className={cn(
        "bg-muted/50 border-border/50 grid w-full rounded-xl border p-1 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </TabsList>
  );
}

interface EnhancedTabsTriggerProps extends React.ComponentProps<typeof TabsTrigger> {
  icon?: React.ElementType;
  badge?: string | number;
}

export function EnhancedTabsTrigger({
  children,
  icon: Icon,
  badge,
  className,
  ...props
}: EnhancedTabsTriggerProps) {
  return (
    <TabsTrigger
      className={cn(
        "data-[state=active]:bg-background relative flex flex-col gap-1.5 p-3 transition-all duration-200 data-[state=active]:shadow-sm",
        "hover:bg-background/50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        {Icon && React.createElement(Icon, { className: "h-4 w-4" })}
      </div>
      <span className="text-xs font-medium">{children}</span>
      {badge !== undefined && (
        <Badge
          variant="secondary"
          className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center p-0 text-[10px]"
        >
          {badge}
        </Badge>
      )}
    </TabsTrigger>
  );
}
