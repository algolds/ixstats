"use client";

import React from "react";
import Link from "next/link";
import { NavArrowDown as ChevronDown } from "iconoir-react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "~/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import type { NavigationItem } from "~/lib/navigation-config";

interface DesktopNavItemProps {
  item: NavigationItem;
  current: boolean;
  messageUnreadCount: number;
  dropdownAlign: "start" | "end";
}

const DesktopNavItem = React.memo(function DesktopNavItem({
  item,
  current,
  messageUnreadCount,
  dropdownAlign,
}: DesktopNavItemProps) {
  const Icon = item.icon;

  if (item.isDropdown && item.dropdownItems) {
    return (
      <NavigationMenuItem key={item.name}>
        <DropdownMenu>
          <DropdownMenuTrigger
            data-cuelume-press="tick"
            className={cn(
              "group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none",
              current
                ? "bg-accent/50 text-foreground"
                : "text-muted-foreground hover:bg-accent/20 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 transition-colors" aria-hidden="true" />
            <span className="hidden lg:inline">{item.name}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align={dropdownAlign} className="facet-panel w-56">
            {item.dropdownItems.map((subItem, index) => {
              const SubIcon = subItem.icon;
              const isMessages = subItem.href === "/messages";
              return (
                <div key={subItem.name}>
                  <DropdownMenuItem asChild>
                    <Link
                      href={subItem.href}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                    >
                      <div className="relative">
                        <SubIcon className="text-muted-foreground h-4 w-4" />
                        {isMessages && messageUnreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                            {messageUnreadCount > 9 ? "9+" : messageUnreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-medium">{subItem.name}</span>
                        {subItem.description && (
                          <span className="text-muted-foreground text-xs">
                            {subItem.description}
                          </span>
                        )}
                      </div>
                      {isMessages && messageUnreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {messageUnreadCount}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  {index < item.dropdownItems!.length - 1 && <DropdownMenuSeparator />}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.name}>
      <Link
        href={item.href}
        data-cuelume-press="tick"
        className={cn(
          "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          current
            ? "bg-accent/50 text-foreground shadow-xs"
            : "text-muted-foreground hover:bg-accent/20 hover:text-foreground"
        )}
        aria-current={current ? "page" : undefined}
      >
        <Icon className="h-4 w-4 shrink-0 transition-colors" aria-hidden="true" />
        <span className="hidden lg:inline">{item.name}</span>
      </Link>
    </NavigationMenuItem>
  );
});

export interface NavigationBarProps {
  visibleNavItems: NavigationItem[];
  isCurrentPage: (href: string) => boolean;
  messageUnreadCount: number;
}

/**
 * Desktop navigation bar: splits visible nav items into balanced left/right
 * groups around the dynamic island.
 */
export function NavigationBar({
  visibleNavItems,
  isCurrentPage,
  messageUnreadCount,
}: NavigationBarProps) {
  // Intelligent balancing: ensure visual symmetry around dynamic island
  const totalItems = visibleNavItems.length;
  const leftCount = Math.ceil(totalItems / 2);
  const leftNavItems = visibleNavItems.slice(0, leftCount);
  const rightNavItems = visibleNavItems.slice(leftCount);

  return (
    <div className="relative hidden h-16 w-full items-center justify-between lg:flex">
      {/* Left Side Navigation */}
      <div className="z-[var(--z-floating)] flex flex-1 items-center justify-start gap-2 xl:gap-3">
        <NavigationMenu>
          <NavigationMenuList className="flex items-center gap-2">
            {leftNavItems.map((item) => (
              <DesktopNavItem
                key={item.name}
                item={item}
                current={isCurrentPage(item.href)}
                messageUnreadCount={messageUnreadCount}
                dropdownAlign="start"
              />
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      {/* Right Side Navigation */}
      <div className="z-[var(--z-floating)] flex flex-1 items-center justify-end gap-2 xl:gap-3">
        <NavigationMenu>
          <NavigationMenuList className="flex items-center gap-2">
            {rightNavItems.map((item) => (
              <DesktopNavItem
                key={item.name}
                item={item}
                current={isCurrentPage(item.href)}
                messageUnreadCount={messageUnreadCount}
                dropdownAlign="end"
              />
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </div>
  );
}
