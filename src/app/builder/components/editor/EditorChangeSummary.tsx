"use client";

import { useMemo } from "react";
import { EditPencil } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import type { BuilderSection } from "../../lib/builder-theme";
import {
  EDITOR_SECTIONS,
  describeChangePath,
  sectionOfChange,
  type EditorSection,
  type FieldChange,
} from "../../lib/edit-changes";
import { EDITOR_SECTION_LABELS } from "./editor-sections";

const MAX_LISTED = 8;

interface EditorChangeSummaryProps {
  changes: readonly FieldChange[];
  onNavigate: (section: BuilderSection) => void;
}

function formatValue(value: FieldChange["value"]): string | null {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number")
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const text = value.trim();
  if (!text) return "(empty)";
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

/** The Review section's list of what changed, grouped by the section it is edited on. */
export function EditorChangeSummary({ changes, onNavigate }: EditorChangeSummaryProps) {
  const groups = useMemo(() => {
    const bySection = new Map<EditorSection, FieldChange[]>();
    for (const change of changes) {
      const section = sectionOfChange(change.path);
      bySection.set(section, [...(bySection.get(section) ?? []), change]);
    }
    return EDITOR_SECTIONS.flatMap((section) => {
      const items = bySection.get(section);
      return items ? [{ section, items }] : [];
    });
  }, [changes]);

  return (
    <FacetCard
      depth={2}
      role="region"
      aria-labelledby="editor-change-summary-title"
      className="space-y-4 rounded-2xl p-4 sm:p-6"
    >
      <div>
        <Eyebrow className="block">Review</Eyebrow>
        <h2 id="editor-change-summary-title" className="text-foreground text-lg font-semibold">
          {changes.length === 0
            ? "No changes yet"
            : `${changes.length} ${changes.length === 1 ? "change" : "changes"} this session`}
        </h2>
        <p className="text-muted-foreground text-sm">
          {changes.length === 0
            ? "Your country matches the version you opened or last saved."
            : "Compared with the country as you opened it or last saved it. Changes save automatically."}
        </p>
      </div>

      {groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {groups.map(({ section, items }) => (
            <FacetContainer key={section} depth={3} surface="solid" className="rounded-xl p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-foreground text-sm font-semibold">
                  {EDITOR_SECTION_LABELS[section]}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onNavigate(section)}
                  aria-label={`Edit ${EDITOR_SECTION_LABELS[section]}`}
                >
                  <EditPencil aria-hidden="true" className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
              <ul className="space-y-1.5">
                {items.slice(0, MAX_LISTED).map((change) => {
                  const value = formatValue(change.value);
                  return (
                    <li
                      key={change.path}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground min-w-0 truncate">
                        {describeChangePath(change.path)}
                      </span>
                      {value !== null && (
                        <span className="text-foreground max-w-[50%] shrink-0 truncate font-medium">
                          {value}
                        </span>
                      )}
                    </li>
                  );
                })}
                {items.length > MAX_LISTED && (
                  <li className="text-muted-foreground text-xs">
                    and {items.length - MAX_LISTED} more
                  </li>
                )}
              </ul>
            </FacetContainer>
          ))}
        </div>
      )}
    </FacetCard>
  );
}
