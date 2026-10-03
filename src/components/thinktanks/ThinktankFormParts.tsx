"use client";

import React from "react";
import { DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export const THINKTANK_CATEGORIES = [
  "Economics",
  "Diplomacy",
  "History & Lore",
  "Military & Defense",
  "Culture & Society",
  "Science & Technology",
];

export function ThinktankDialogHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <DialogHeader>
      <div className="flex items-center gap-3">
        <div className="bg-tint-fill text-tint rounded-control flex size-9 items-center justify-center">
          {icon}
        </div>
        <div>
          <DialogTitle className="text-title-3">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );
}

export function ThinktankField({
  label,
  labelId,
  className = "space-y-2",
  children,
}: {
  label: string;
  labelId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(className)}>
      <label id={labelId} className="text-subhead text-label">
        {label}
      </label>
      {children}
    </div>
  );
}
