"use client";

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";

import { cn } from "~/lib/utils/cn";
import { SurfaceReset } from "~/components/ui/card";
import { presentMotionClassName } from "~/components/ui/dialog";
import {
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  MenuKindContext,
  menuSurface,
} from "~/components/ui/dropdown-menu";

/**
 * Right-click (long-press on touch, Shift+F10 or the Menu key) menu for a thing with an identity: a
 * post, a card, a map feature. It is a shortcut, never the only way in: render the same items
 * fragment in the thing's visible "More actions" dropdown. The dropdown item components work in
 * both menus.
 */
function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

/**
 * The browser's own menu wins where it is the useful one: Shift+right-click, text fields, a
 * selection inside the trigger, and links inside it (open in new tab). The trigger itself may be
 * a link.
 */
export function prefersNativeMenu(event: React.MouseEvent<Element>): boolean {
  const target = event.target as Element;
  const trigger = event.currentTarget;
  if (event.shiftKey) return true;
  if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"))
    return true;
  const link = target.closest("a[href]");
  if (link && link !== trigger && trigger.contains(link)) return true;
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && trigger.contains(selection.anchorNode);
}

function ContextMenuTrigger({
  disabled,
  onPointerDown,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  // Decided on the right button's pointerdown, which lands (and re-renders) before `contextmenu`.
  const [native, setNative] = React.useState(false);
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      disabled={disabled || native}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.button === 2) setNative(prefersNativeMenu(event));
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))
          setNative(false);
      }}
      {...props}
    />
  );
}

function ContextMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          menuSurface,
          "max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto",
          presentMotionClassName,
          className
        )}
        {...props}
      >
        <MenuKindContext.Provider value="context">
          <SurfaceReset>{children}</SurfaceReset>
        </MenuKindContext.Provider>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuGroupLabel as ContextMenuGroupLabel,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
  DropdownMenuSeparator as ContextMenuSeparator,
};
