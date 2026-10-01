"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

interface TemplateModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: ReactNode;
  /** Width and layout overrides for the dialog body (default `max-w-lg`). */
  className?: string;
  /** Layout for the area under the title (default: a scrolling column). */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Shared frame for the editor's template-insert forms (spec §7.3: a short focused form that
 * blocks the page is a `Dialog`). Escape and the close button dismiss; the content scrolls.
 */
export function TemplateModalShell({
  isOpen,
  onClose,
  icon,
  title,
  className,
  bodyClassName,
  children,
}: TemplateModalShellProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className={cn("flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0", className)}
      >
        <div className="border-separator flex shrink-0 items-center gap-2 border-b px-6 py-4 pr-14">
          {icon}
          <DialogTitle className="text-title-3">{title}</DialogTitle>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
