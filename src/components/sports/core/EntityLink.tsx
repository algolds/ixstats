"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { useSportsFocus } from "./SportsFocusProvider";
import type { SportsFocusType } from "~/lib/sports/contracts";

export interface EntityLinkProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "color"> {
  type: SportsFocusType;
  buttonType?: "button" | "submit" | "reset";
  id: string;
  name?: string;
  avatar?: string | null;
  badge?: string | null;
  color?: string | null;
  children?: React.ReactNode;
  variant?: "inline" | "badge" | "card" | "plain";
  className?: string;
  showIcon?: boolean;
}

export function EntityLink({
  type,
  id,
  name,
  avatar,
  badge,
  color,
  children,
  variant = "inline",
  className,
  onClick,
  ...props
}: EntityLinkProps) {
  const { setFocus } = useSportsFocus();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setFocus({ type, id }, true);
    }
  };

  const content = children || (
    <span className="flex items-center gap-1.5">
      {avatar && (
        <img
          src={avatar}
          alt=""
          className="h-4 w-4 shrink-0 rounded-full object-cover"
        />
      )}
      <span className="truncate font-semibold">{name || id}</span>
      {badge && (
        <span className="text-muted-foreground/80 bg-muted/40 rounded px-1 text-[11px] font-bold">
          {badge}
        </span>
      )}
    </span>
  );

  if (variant === "plain") {
    return (
      <button
        type="button"
        onClick={handleClick}
        data-cuelume-press="subtle"
        className={cn(
          "cursor-pointer text-left transition-colors duration-150 outline-none select-none hover:underline focus-visible:ring-1 focus-visible:ring-ring",
          "active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {content}
      </button>
    );
  }

  if (variant === "badge") {
    return (
      <button
        type="button"
        onClick={handleClick}
        data-cuelume-press="subtle"
        style={color ? { borderColor: `${color}40`, backgroundColor: `${color}15` } : {}}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur-sm transition-all duration-150 outline-none select-none hover:bg-muted/40 hover:border-border",
          "active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {content}
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={handleClick}
        data-cuelume-press="subtle"
        className={cn(
          "facet-hierarchy-child group flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/40 bg-card/60 p-3 text-left backdrop-blur-md transition-all duration-200 outline-none select-none hover:border-border hover:bg-muted/30",
          "active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {content}
      </button>
    );
  }

  // Default: inline link
  return (
    <button
      type="button"
      onClick={handleClick}
      data-cuelume-press="subtle"
      className={cn(
        "hover:text-primary inline-flex cursor-pointer items-center gap-1 font-semibold text-foreground transition-colors duration-150 outline-none select-none hover:underline",
        "active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {content}
    </button>
  );
}
