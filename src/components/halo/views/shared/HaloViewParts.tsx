"use client";

import type * as React from "react";
import { Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/lib/utils";
import { useHaloMaterial, WELL_MATERIAL } from "../../halo-material";

export interface HaloCloseButtonProps {
  onClick: () => void;
  className?: string;
}

export function HaloCloseButton({ onClick, className }: HaloCloseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label="Close"
      className={cn("text-label-secondary hover:text-label", className)}
    >
      <Xmark aria-hidden />
    </Button>
  );
}

export interface HaloViewHeaderProps {
  title: React.ReactNode;
  titleId?: string;
  onClose: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function HaloViewHeader({
  title,
  titleId,
  onClose,
  leading,
  trailing,
  className,
}: HaloViewHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2 pl-1", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <h2 id={titleId} className="text-headline text-label truncate">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {trailing}
        <HaloCloseButton onClick={onClose} />
      </div>
    </div>
  );
}

export interface HaloWellProps {
  children: React.ReactNode;
  className?: string;
  /** Labels the well for assistive technology when it has a visible heading. */
  "aria-labelledby"?: string;
}

/**
 * One section of an expanded Halo view. Sections are wells, separated by spacing rather than hairlines; the material
 * follows the island (solid on the Lens island, Lens on the Chrome comparison island).
 */
export function HaloWell({ children, className, ...props }: HaloWellProps) {
  const material = useHaloMaterial();
  return (
    <section
      data-slot="halo-well"
      className={cn(WELL_MATERIAL[material], "rounded-row p-3", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export interface HaloEmptyProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  message?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function HaloEmpty({ icon, title, message, action, className }: HaloEmptyProps) {
  return (
    <EmptyState
      compact
      icon={icon}
      title={title}
      message={message}
      action={action}
      className={cn("px-4 py-6", className)}
    />
  );
}
