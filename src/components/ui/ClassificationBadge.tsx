import React from "react";
import { RiLockLine } from "react-icons/ri";
import { cn } from "~/lib/utils";

// Intelligence Classification Levels
export const CLASSIFICATION_LEVELS = {
  'PUBLIC': { color: 'text-green-400', bg: 'bg-green-500/20', label: 'PUBLIC' },
  'RESTRICTED': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'RESTRICTED' },
  'CONFIDENTIAL': { color: 'text-red-400', bg: 'bg-red-500/20', label: 'CONFIDENTIAL' }
} as const;

interface ClassificationBadgeProps {
  level: keyof typeof CLASSIFICATION_LEVELS;
}

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({ level }) => {
  const classification = CLASSIFICATION_LEVELS[level];
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
      classification.bg, classification.color,
      "border border-current/20"
    )}>
      <RiLockLine className="h-3 w-3" />
      {classification.label}
    </div>
  );
};
