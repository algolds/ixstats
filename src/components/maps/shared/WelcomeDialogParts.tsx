"use client";

import type { ComponentType, ReactNode } from "react";
import { motion } from "motion/react";
import { NavArrowRight as ChevronRight, NavArrowLeft as ChevronLeft } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

/** Titled blurb with a blue icon, used in the welcome dialogs' tips pages. */
export function TipCard({
  icon: Icon,
  title,
  description,
  className = "p-3",
  headerClassName = "mb-2",
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <Card variant="inset" className={className}>
      <div className={`flex items-center gap-2 ${headerClassName}`}>
        <Icon className="text-blue h-4 w-4" aria-hidden />
        <h3 className="text-label text-headline">{title}</h3>
      </div>
      <p className="text-label-secondary text-footnote leading-relaxed">{description}</p>
    </Card>
  );
}

/**
 * A dialog page that slides in from the left (`from="left"`) or right as it fades in. Give each
 * page its own `key` so the parent `AnimatePresence` can run the exit animation.
 */
export function SlidePage({
  from,
  duration = 0.2,
  className,
  children,
}: {
  from: "left" | "right";
  duration?: number;
  className?: string;
  children: ReactNode;
}) {
  const offset = from === "left" ? -10 : 10;
  return (
    <motion.div
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -offset }}
      transition={{ duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Page dots plus Back / Next; `finalActions` replaces Next on the last page. */
export function WelcomeFooter({
  page,
  totalPages,
  onPageChange,
  activeDotClass = "w-5",
  finalActions,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeDotClass?: string;
  finalActions: ReactNode;
}) {
  return (
    <div className="border-separator flex items-center justify-between border-t px-6 py-4">
      <div className="flex items-center gap-2">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Page ${i + 1} of ${totalPages}`}
            aria-current={i === page ? "step" : undefined}
            onClick={() => onPageChange(i)}
            className={`h-1.5 rounded-full transition-[background-color,opacity] ${
              i === page ? `bg-blue ${activeDotClass}` : "bg-fill-2 hover:bg-fill w-1.5"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {page > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)}>
            <ChevronLeft aria-hidden />
            Back
          </Button>
        )}
        {page < totalPages - 1 ? (
          <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)}>
            Next
            <ChevronRight aria-hidden />
          </Button>
        ) : (
          finalActions
        )}
      </div>
    </div>
  );
}
