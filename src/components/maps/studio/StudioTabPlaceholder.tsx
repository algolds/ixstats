"use client";

import { useStudio } from "./StudioContext";

interface StudioTabPlaceholderProps {
  title: string;
  /** What the tab is for */
  children: string;
}

/**
 * The slot of an inspector tab whose content is not built yet. It reads the Studio's context like the real tab will,
 * so the seam is exercised: `useStudio()` is everything a tab gets.
 */
export function StudioTabPlaceholder({ title, children }: StudioTabPlaceholderProps) {
  const { generator } = useStudio();
  return (
    <div className="space-y-1 p-3">
      <h3 className="text-headline">{title}</h3>
      <p className="text-label-secondary text-footnote">{children}</p>
      {generator.result === null && (
        <p className="text-label-secondary text-caption">There is no world yet.</p>
      )}
    </div>
  );
}
