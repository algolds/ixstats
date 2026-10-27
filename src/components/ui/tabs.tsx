"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "~/lib/utils/cn";

/**
 * Page-level section switching on Radix Tabs (WAI-ARIA tabs, roving tab stop, automatic
 * activation). For a choice between 2-5 peer views inside a page, use `SegmentedControl`.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("w-full", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex data-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-body inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium whitespace-nowrap",
        "ease-out-facet transition-[color,background-color,box-shadow] duration-150",
        "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
        "disabled:pointer-events-none disabled:opacity-50",
        "text-label-secondary hover:bg-fill-4 hover:text-label bg-transparent",
        "data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-card data-[state=active]:hover:bg-surface",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "focus-visible:outline-tint w-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
