"use client";

import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { NavArrowDown as ChevronDownIcon } from "iconoir-react";

import { cn } from "~/lib/utils/cn";

interface NavigationMenuProps extends React.ComponentProps<typeof NavigationMenuPrimitive.Root> {
  /** Legacy prop from the prior Base UI implementation; accepted for compatibility. */
  contentProps?: Record<string, unknown>;
}

function NavigationMenu({
  className,
  children,
  contentProps: _contentProps,
  ...props
}: NavigationMenuProps) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
      <NavigationMenuViewport />
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn("flex flex-1 list-none items-center justify-center gap-1", className)}
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-(--control-height) w-max items-center justify-center rounded-control bg-transparent px-4 text-body font-medium text-label transition-colors duration-fast ease-out-facet hover:bg-fill-4 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-fill-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint"
);

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className="relative top-[1px] ml-1 size-3.5 transition duration-300 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "data-[motion^=from-]:animate-facet-fade-in data-[motion^=to-]:animate-facet-fade-out top-0 left-0 w-full p-4 md:absolute md:w-auto",
        "**:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col gap-1 rounded-control-sm p-2 text-body text-label no-underline transition-colors duration-fast ease-out-facet outline-none hover:bg-fill-4 focus:bg-fill-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint data-[active=true]:bg-fill-3 [&_svg:not([class*='text-'])]:text-label-secondary [:where(&)_svg]:size-4",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuViewport({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div className="absolute top-full left-0 isolate z-50 flex justify-center">
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          "relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full origin-top overflow-hidden rounded-card border border-separator bg-surface-elevated text-label shadow-floating md:w-(--radix-navigation-menu-viewport-width)",
          "data-[state=open]:animate-facet-in data-[state=closed]:animate-facet-out",
          className
        )}
        {...props}
      />
    </div>
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn(
        "data-[state=visible]:animate-facet-fade-in data-[state=hidden]:animate-facet-fade-out top-full z-1 flex h-1.5 items-end justify-center overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-separator-opaque" />
    </NavigationMenuPrimitive.Indicator>
  );
}

// ── Compatibility shims (legacy export names; no remaining consumers) ──────────
/** Legacy Base UI chevron icon slot. */
function NavigationMenuIcon({ className }: { className?: string }) {
  return <ChevronDownIcon className={cn("size-3.5", className)} aria-hidden="true" />;
}
/** Radix has no backdrop primitive for the navigation menu. */
function NavigationMenuBackdrop() {
  return null;
}
/** Radix renders content inline via the Viewport; Portal is a pass-through. */
function NavigationMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
/** Legacy submenu trigger alias. */
const NavigationSubMenuTrigger = NavigationMenuTrigger;

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuIcon,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuBackdrop,
  NavigationMenuPortal,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
  NavigationSubMenuTrigger,
};
