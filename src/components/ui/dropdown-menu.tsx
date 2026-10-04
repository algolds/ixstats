"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Circle } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { SurfaceReset } from "~/components/ui/card";
import { presentMotionClassName } from "~/components/ui/dialog";

/** Menu surface: the overlay layer with an origin-aware pop. */
const menuSurface =
  "z-popover min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) rounded-row p-1 facet-overlay text-label";

/** Menu rows: nested radius (12 − 4 padding = 8), fill-3 highlight, body text. */
const menuRow =
  "relative flex cursor-default items-center gap-2 rounded-control-sm min-h-8 px-2 py-1 text-body outline-none select-none transition-colors duration-fast ease-out-facet data-[highlighted]:bg-fill-3 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-label-secondary [:where(&)_svg]:size-4";

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          menuSurface,
          "max-h-(--radix-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto",
          presentMotionClassName,
          className
        )}
        {...props}
      >
        <SurfaceReset>{children}</SurfaceReset>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

interface DropdownMenuItemProps extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        menuRow,
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/12 data-[variant=destructive]:*:[svg]:text-destructive data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

interface DropdownMenuGroupLabelProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.Label
> {
  inset?: boolean;
}

function DropdownMenuGroupLabel({ className, inset, ...props }: DropdownMenuGroupLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-group-label"
      data-inset={inset}
      className={cn("text-footnote text-label-secondary px-2 py-1 data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(menuRow, "pr-2 pl-8", className)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-separator -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

const DropdownMenuLabel = DropdownMenuGroupLabel;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
};
