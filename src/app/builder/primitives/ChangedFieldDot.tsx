"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  indexChangesByName,
  isFieldChanged,
  type ChangedFieldIndex,
  type FieldChange,
} from "~/app/builder/lib/edit-changes";

const EditChangesContext = createContext<ChangedFieldIndex>(new Map());

/** Supplies the editor's changed fields to every ChangedFieldDot below it. */
export function EditChangesProvider({
  changes,
  children,
}: {
  changes: readonly FieldChange[];
  children: React.ReactNode;
}) {
  const index = useMemo(() => indexChangesByName(changes), [changes]);
  return <EditChangesContext.Provider value={index}>{children}</EditChangesContext.Provider>;
}

interface ChangedFieldDotProps {
  /** The field's key or visible label. */
  name?: string;
  value: string | number | boolean;
}

/**
 * Small amber dot for a field label when the field differs from the editor's
 * baseline (the country as opened, or as of the last Save). Renders nothing
 * outside the editor.
 */
export function ChangedFieldDot({ name, value }: ChangedFieldDotProps) {
  const index = useContext(EditChangesContext);
  if (!name || !isFieldChanged(index, name, value)) return null;
  return (
    <span className="inline-flex shrink-0 items-center" title="Changed">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      <span className="sr-only">(changed)</span>
    </span>
  );
}
