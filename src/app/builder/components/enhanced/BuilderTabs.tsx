"use client";

import React from 'react';
import { TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

interface EnhancedTabsListProps extends React.ComponentProps<typeof TabsList> {}

export function EnhancedTabsList({ children, className, ...props }: EnhancedTabsListProps) {
  return (
    <TabsList
      className={cn(
        "grid w-full bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-xl",
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
        "relative flex flex-col gap-1.5 p-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200",
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
        <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]">
          {badge}
        </Badge>
      )}
    </TabsTrigger>
  );
}
