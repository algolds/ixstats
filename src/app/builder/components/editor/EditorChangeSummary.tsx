"use client";

import { useMemo } from "react";
import { EditPencil } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
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
      role="region"
      aria-labelledby="editor-change-summary-title"
      className="rounded-card space-y-4 p-4 sm:p-6"
    >
      <div>
        <Eyebrow className="block">Review</Eyebrow>
        <h2 id="editor-change-summary-title" className="text-label text-title-3">
          {changes.length === 0
            ? "No changes yet"
            : `${changes.length} ${changes.length === 1 ? "change" : "changes"} this session`}
        </h2>
        <p className="text-label-secondary text-body">
          {changes.length === 0
            ? "Your country matches the version you opened or last saved."
            : "Compared with the country as you opened it or last saved it. Changes save automatically."}
        </p>
      </div>

      {groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {groups.map(({ section, items }) => (
            <div key={section} className="bg-surface-secondary rounded-row p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-label text-headline">{EDITOR_SECTION_LABELS[section]}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(section)}
                  aria-label={`Edit ${EDITOR_SECTION_LABELS[section]}`}
                >
                  <EditPencil aria-hidden="true" className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
              <ul className="space-y-2">
                {items.slice(0, MAX_LISTED).map((change) => {
                  const value = formatValue(change.value);
                  return (
                    <li
                      key={change.path}
                      className="text-body flex items-baseline justify-between gap-2"
                    >
                      <span className="text-label-secondary min-w-0 truncate">
                        {describeChangePath(change.path)}
                      </span>
                      {value !== null && (
                        <span className="text-label max-w-[50%] shrink-0 truncate font-medium">
                          {value}
                        </span>
                      )}
                    </li>
                  );
                })}
                {items.length > MAX_LISTED && (
                  <li className="text-label-secondary text-footnote">
                    and {items.length - MAX_LISTED} more
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </FacetCard>
  );
}
