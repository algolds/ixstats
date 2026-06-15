"use client";

import React, { useState, useCallback } from "react";
import { Trash2, X, Pencil, Check } from "lucide-react";

// Whitelisted editable attributes — intentionally excludes name, id, capital flags.
const EDITABLE_FIELDS = [
  { value: "color", label: "Color", inputType: "color" as const },
  { value: "type", label: "Type", inputType: "select" as const },
  { value: "level", label: "Admin Level", inputType: "number" as const },
  { value: "governmentType", label: "Gov. Type", inputType: "text" as const },
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number]["value"];

const SUBDIVISION_TYPES = [
  { value: "province", label: "Province" },
  { value: "state", label: "State" },
  { value: "region", label: "Region" },
  { value: "territory", label: "Territory" },
  { value: "district", label: "District" },
  { value: "county", label: "County" },
  { value: "department", label: "Department" },
];

interface BatchActionsBarProps {
  selectedCount: number;
  /** Number of selected features that are subdivisions (bulk-edit target type). */
  subdivisionCount: number;
  onBatchDelete: () => void;
  onDeselectAll: () => void;
  /** Called when the user confirms a bulk-edit. Returns { successCount, failCount }. */
  onBulkEdit: (
    field: EditableField,
    value: string | number
  ) => Promise<{ successCount: number; failCount: number }>;
  isMutating: boolean;
}

export const BatchActionsBar = React.memo(function BatchActionsBar({
  selectedCount,
  subdivisionCount,
  onBatchDelete,
  onDeselectAll,
  onBulkEdit,
  isMutating,
}: BatchActionsBarProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [field, setField] = useState<EditableField>("color");
  const [value, setValue] = useState<string>("#3b82f6");
  const [pending, setPending] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const selectedFieldMeta = EDITABLE_FIELDS.find((f) => f.value === field)!;

  const handleFieldChange = useCallback((nextField: EditableField) => {
    setField(nextField);
    setResultMsg(null);
    // Reset value to a sensible default for the new field
    if (nextField === "color") setValue("#3b82f6");
    else if (nextField === "level") setValue("1");
    else setValue("");
  }, []);

  const handleApply = useCallback(async () => {
    if (!value.trim()) return;
    const coerced: string | number =
      field === "level" ? parseInt(value, 10) : value;
    if (field === "level" && isNaN(coerced as number)) return;

    setPending(true);
    setResultMsg(null);
    try {
      const { successCount, failCount } = await onBulkEdit(field, coerced);
      if (failCount === 0) {
        setResultMsg(`Updated ${successCount}`);
      } else {
        setResultMsg(`${successCount} ok, ${failCount} failed`);
      }
      setEditOpen(false);
    } finally {
      setPending(false);
    }
  }, [field, value, onBulkEdit]);

  if (selectedCount === 0) return null;

  const canBulkEdit = subdivisionCount > 0 && !isMutating;

  return (
    <div className="border-border bg-muted/50 flex min-h-8 flex-wrap items-center gap-2 border-b px-3 py-1 text-xs">
      <span className="text-foreground font-medium">{selectedCount} selected</span>
      {subdivisionCount > 0 && subdivisionCount < selectedCount && (
        <span className="text-muted-foreground">
          ({subdivisionCount} subdivision{subdivisionCount !== 1 ? "s" : ""})
        </span>
      )}

      <div className="bg-border mx-1 h-4 w-px" />

      <button
        onClick={onDeselectAll}
        disabled={isMutating}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded px-2 py-1 transition-colors disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        Deselect All
      </button>

      {/* Bulk Edit — subdivisions only */}
      {canBulkEdit && !editOpen && (
        <button
          onClick={() => {
            setEditOpen(true);
            setResultMsg(null);
          }}
          disabled={isMutating}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded px-2 py-1 transition-colors disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" />
          Edit {subdivisionCount} region{subdivisionCount !== 1 ? "s" : ""}
        </button>
      )}

      {editOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Field picker */}
          <select
            value={field}
            onChange={(e) => handleFieldChange(e.target.value as EditableField)}
            disabled={pending}
            className="bg-background border-border rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
          >
            {EDITABLE_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {/* Value input — varies by field type */}
          {selectedFieldMeta.inputType === "select" && (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="bg-background border-border rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
            >
              {SUBDIVISION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          {selectedFieldMeta.inputType === "color" && (
            <input
              type="color"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="h-6 w-10 cursor-pointer rounded border-0 p-0 disabled:opacity-50"
              title="Pick color"
            />
          )}

          {selectedFieldMeta.inputType === "number" && (
            <input
              type="number"
              min={1}
              max={5}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="bg-background border-border w-14 rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
              placeholder="1–5"
            />
          )}

          {selectedFieldMeta.inputType === "text" && (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="bg-background border-border w-28 rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
              placeholder="e.g. monarchy"
            />
          )}

          <button
            onClick={handleApply}
            disabled={pending || !value.trim()}
            className="flex items-center gap-1 rounded bg-blue-600/80 px-2 py-0.5 text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Apply to {subdivisionCount}
          </button>

          <button
            onClick={() => setEditOpen(false)}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground px-1 transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {resultMsg && (
        <span className="text-muted-foreground italic">{resultMsg}</span>
      )}

      <button
        onClick={onBatchDelete}
        disabled={isMutating}
        className="flex items-center gap-1 rounded px-2 py-1 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Delete Selected
      </button>
    </div>
  );
});
