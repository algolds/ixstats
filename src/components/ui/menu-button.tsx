"use client";

import * as React from "react";
import { NavArrowDown } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Button, type ButtonProps } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";

/**
 * MenuButton (spec §7.2): a Button that opens a menu — toolbar "Sort", "View", "More" and similar.
 * The children are the menu's contents (`DropdownMenuItem`, `DropdownMenuRadioGroup`, …).
 *
 * ```tsx
 * <MenuButton label="Sort" size="sm" align="end">
 *   <DropdownMenuItem onSelect={() => setSort("name")}>Name</DropdownMenuItem>
 *   <DropdownMenuItem onSelect={() => setSort("date")}>Date</DropdownMenuItem>
 * </MenuButton>
 * ```
 *
 * Icon-only (`size="icon" | "icon-sm" | "icon-lg"`): pass the icon as `label` and an `aria-label`;
 * the chevron is hidden.
 */
export interface MenuButtonProps extends Omit<ButtonProps, "asChild" | "children"> {
  /** Button content. */
  label: React.ReactNode;
  /** Leading icon element. */
  icon?: React.ReactNode;
  /** Menu contents. */
  children: React.ReactNode;
  /** Trailing disclosure chevron. @default true unless the size is an icon size */
  showChevron?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** @default true */
  modal?: boolean;
  /** @default "start" */
  align?: "start" | "center" | "end";
  /** @default "bottom" */
  side?: "top" | "right" | "bottom" | "left";
  contentClassName?: string;
}

export const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(
  (
    {
      label,
      icon,
      children,
      showChevron,
      open,
      defaultOpen,
      onOpenChange,
      modal,
      align = "start",
      side = "bottom",
      contentClassName,
      variant = "gray",
      size,
      className,
      ...buttonProps
    },
    ref
  ) => {
    const isIconSize = typeof size === "string" && size.startsWith("icon");
    const chevron = showChevron ?? !isIconSize;
    return (
      <DropdownMenu open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            data-slot="menu-button"
            variant={variant}
            size={size}
            className={cn("group/menu-button", className)}
            {...buttonProps}
          >
            {icon}
            {label}
            {chevron && (
              <NavArrowDown
                aria-hidden
                className="-mr-1 size-3.5 opacity-60 transition-transform duration-150 ease-out-facet group-data-[state=open]/menu-button:rotate-180"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className={contentClassName}>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
MenuButton.displayName = "MenuButton";
