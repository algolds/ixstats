"use client";

import React from "react";
import { HelpIcon } from "~/components/ui/help-icon";

/**
 * Inline help tooltip for specific fields
 */
export function FieldHelpTooltip({
  content,
  title,
  className,
}: {
  content: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <HelpIcon content={content} title={title} className={className} side="top" variant="help" />
  );
}

/**
 * Section help tooltip for section headers
 */
export function SectionHelpTooltip({
  content,
  title,
  className,
}: {
  content: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <HelpIcon content={content} title={title} className={className} side="top" variant="info" />
  );
}
