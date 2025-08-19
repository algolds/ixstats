"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "~/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          // Enhanced z-index and glass styling for better depth - highest z-index for tooltip visibility
          "z-[999999] w-fit max-w-sm origin-(--radix-tooltip-content-transform-origin) rounded-xl px-4 py-3 text-sm text-balance",
          // Advanced glass styling with proper theme compliance
          !className?.includes('glass-') && [
            "glass-modal backdrop-blur-xl",
            "bg-white/95 dark:bg-gray-900/95",
            "border border-white/20 dark:border-gray-700/50", 
            "shadow-2xl shadow-black/25 dark:shadow-black/50",
            "text-gray-900 dark:text-gray-100"
          ],
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-[999999] size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] fill-white/95 dark:fill-gray-900/95 drop-shadow-lg" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
