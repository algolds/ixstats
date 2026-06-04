"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
import { AnimatedShinyText } from "~/components/magicui/animated-shiny-text";
import { ShineBorder } from "~/components/magicui/shine-border";
import { NAV_COLORS, DEFAULT_NAV, type NavigationItem } from "~/lib/navigation-config";

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
          <DropdownMenuTrigger className="group hover:bg-accent/10 text-muted-foreground relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto">
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ShineBorder
                shineColor={["#8b5cf6", "#7c3aed", "#a78bfa"]}
                duration={30}
                borderWidth={1}
                className="rounded-lg"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                <Icon className="h-4 w-4 text-purple-400" />
              </div>
              <Icon
                className="relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] group-hover:text-purple-400"
                aria-hidden="true"
              />
            </div>
            <span className="relative hidden overflow-hidden lg:block">
              <span className="transition-opacity duration-300 group-hover:opacity-0">
                {item.name}
              </span>
              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
              </div>
            </span>
            <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align={dropdownAlign} className="glass-panel w-56">
            {item.dropdownItems.map((subItem, index) => {
              const SubIcon = subItem.icon;
              const isMessages = subItem.href === "/messages";
              return (
                <div key={subItem.name}>
                  <DropdownMenuItem>
                    <Link
                      href={subItem.href}
                      className="flex cursor-pointer items-center gap-3 px-3 py-3"
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
                        <span className="font-medium">{subItem.name}</span>
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
      {current ? (
        <Link
          href={item.href}
          className="group text-foreground bg-accent/20 relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto"
          aria-current="page"
        >
          <div className="relative">
            <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
              <Icon
                className={`h-4 w-4 ${
                  item.name === "MyCountry®"
                    ? "text-amber-400"
                    : item.name === "ThinkPages"
                      ? "text-blue-400"
                      : item.name === "Dashboard"
                        ? "text-emerald-400"
                        : item.name === "Feed"
                          ? "text-purple-400"
                          : item.name === "Explore"
                            ? "text-purple-400"
                            : item.name === "Intelligence"
                              ? "text-indigo-400"
                              : item.name === "Admin"
                                ? "text-red-400"
                                : item.name === "Cards"
                                  ? "text-cyan-400"
                                  : item.name === "Help"
                                    ? "text-orange-400"
                                    : "text-blue-400"
                }`}
              />
            </div>
            <Icon
              className={`relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] ${
                item.name === "MyCountry®"
                  ? "group-hover:text-amber-400"
                  : item.name === "ThinkPages"
                    ? "group-hover:text-blue-400"
                    : item.name === "Dashboard"
                      ? "group-hover:text-emerald-400"
                      : item.name === "Feed"
                        ? "group-hover:text-purple-400"
                        : item.name === "Countries" || item.name === "Explore"
                          ? "group-hover:text-purple-400"
                          : item.name === "Admin"
                            ? "group-hover:text-red-400"
                            : item.name === "Cards"
                              ? "group-hover:text-cyan-400"
                              : item.name === "Help"
                                ? "group-hover:text-orange-400"
                                : "group-hover:text-blue-400"
              }`}
              aria-hidden="true"
            />
          </div>
          <span className="relative hidden overflow-hidden lg:block">
            <span className="transition-opacity duration-300 group-hover:opacity-0">
              {item.name}
            </span>
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
            </div>
          </span>
        </Link>
      ) : (
        <Link
          href={item.href}
          className="group hover:bg-accent/10 text-muted-foreground relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto"
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ShineBorder
              shineColor={(NAV_COLORS[item.name] ?? DEFAULT_NAV).shine}
              duration={30}
              borderWidth={1}
              className="rounded-lg"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
              <Icon className={`h-4 w-4 ${(NAV_COLORS[item.name] ?? DEFAULT_NAV).glow}`} />
            </div>
            <Icon
              className={`relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] ${(NAV_COLORS[item.name] ?? DEFAULT_NAV).hover}`}
              aria-hidden="true"
            />
          </div>
          <span className="relative hidden overflow-hidden text-sm whitespace-nowrap lg:block xl:text-base">
            <span className="transition-opacity duration-300 group-hover:opacity-0">
              {item.name}
            </span>
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
            </div>
          </span>
        </Link>
      )}
    </NavigationMenuItem>
  );
});

export interface NavigationBarProps {
  visibleNavItems: NavigationItem[];
  isCurrentPage: (href: string) => boolean;
  morphProgress: number;
  messageUnreadCount: number;
}

/**
 * Desktop navigation bar: splits visible nav items into balanced left/right
 * groups around the dynamic island and renders them with morph-progress driven
 * transforms. Extracted from navigation.tsx.
 */
export function NavigationBar({
  visibleNavItems,
  isCurrentPage,
  morphProgress,
  messageUnreadCount,
}: NavigationBarProps) {
  // Intelligent balancing: ensure visual symmetry around dynamic island
  const totalItems = visibleNavItems.length;
  const leftCount = Math.ceil(totalItems / 2);
  const leftNavItems = visibleNavItems.slice(0, leftCount);
  const rightNavItems = visibleNavItems.slice(leftCount);

  return (
    <div className="relative hidden h-16 w-full items-center justify-between lg:flex">
      {/* Left Side Navigation — morphs toward center */}
      <div
        className="z-[var(--z-floating)] flex flex-1 items-center justify-start gap-2 xl:gap-3"
        style={{
          transform: `translateX(${morphProgress * 30}%) scale(${1 - morphProgress * 0.3})`,
          opacity: 1 - morphProgress,
          pointerEvents: morphProgress > 0.8 ? "none" : "auto",
          transition: "transform 0.05s linear, opacity 0.05s linear",
        }}
      >
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

      {/* Right Side Navigation — morphs toward center */}
      <div
        className="z-[var(--z-floating)] flex flex-1 items-center justify-end gap-2 xl:gap-3"
        style={{
          transform: `translateX(${-morphProgress * 30}%) scale(${1 - morphProgress * 0.3})`,
          opacity: 1 - morphProgress,
          pointerEvents: morphProgress > 0.8 ? "none" : "auto",
          transition: "transform 0.05s linear, opacity 0.05s linear",
        }}
      >
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
