"use client";

import { Button } from "~/components/ui/button";
import React, { useState, useCallback } from "react";
import { Trash as Trash2, Xmark as X, EditPencil as Pencil, Check } from "iconoir-react";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { SUBDIVISION_TYPE_OPTIONS } from "./optionLists";

// Whitelisted editable attributes — intentionally excludes name, id, capital flags.
const EDITABLE_FIELDS = [
  { value: "color", label: "Color", inputType: "color" as const },
  { value: "type", label: "Type", inputType: "select" as const },
  { value: "level", label: "Admin level", inputType: "number" as const },
  { value: "governmentType", label: "Gov. Type", inputType: "text" as const },
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number]["value"];

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
    else if (nextField === "type") setValue("province");
    else setValue("");
  }, []);

  const handleApply = useCallback(async () => {
    if (!value.trim()) return;
    const coerced: string | number = field === "level" ? parseInt(value, 10) : value;
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
    <div className="text-footnote flex min-h-9 flex-wrap items-center gap-2 px-3 py-1">
      <span className="text-label font-medium">{selectedCount} selected</span>
      {subdivisionCount > 0 && subdivisionCount < selectedCount && (
        <span className="text-label-secondary">
          ({subdivisionCount} subdivision{subdivisionCount !== 1 ? "s" : ""})
        </span>
      )}

      <div className="bg-separator mx-1 h-4 w-px" />

      <Button
        variant="ghost"
        size="xs"
        className="text-label-secondary"
        onClick={onDeselectAll}
        disabled={isMutating}
      >
        <X className="h-3 w-3" />
        Deselect all
      </Button>

      {canBulkEdit && !editOpen && (
        <Button
          variant="ghost"
          size="xs"
          className="text-label-secondary"
          onClick={() => {
            setEditOpen(true);
            setResultMsg(null);
          }}
          disabled={isMutating}
        >
          <Pencil className="h-3 w-3" />
          Edit {subdivisionCount} region{subdivisionCount !== 1 ? "s" : ""}
        </Button>
      )}

      {editOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <OptionSelect
            disabled={pending}
            value={field}
            onValueChange={(v) => handleFieldChange(v as EditableField)}
            options={EDITABLE_FIELDS}
            size="sm"
            className="w-full"
          />

          {selectedFieldMeta.inputType === "select" && (
            <OptionSelect
              disabled={pending}
              value={value}
              onValueChange={(v) => setValue(v)}
              options={SUBDIVISION_TYPE_OPTIONS}
              size="sm"
              className="w-full"
            />
          )}

          {selectedFieldMeta.inputType === "color" && (
            <input
              type="color"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="rounded-control-sm h-6 w-10 cursor-pointer border-0 p-0 disabled:opacity-50"
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
              className="bg-surface border-separator text-footnote rounded-control-sm w-14 border px-2 py-0.5 disabled:opacity-50"
              placeholder="1–5"
            />
          )}

          {selectedFieldMeta.inputType === "text" && (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="bg-surface border-separator text-footnote rounded-control-sm w-28 border px-2 py-0.5 disabled:opacity-50"
              placeholder="e.g. monarchy"
            />
          )}

          <Button size="xs" onClick={handleApply} disabled={pending || !value.trim()}>
            <Check className="h-3 w-3" />
            Apply to {subdivisionCount}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-label-secondary"
            onClick={() => setEditOpen(false)}
            disabled={pending}
            aria-label="Cancel"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {resultMsg && <span className="text-label-secondary italic">{resultMsg}</span>}

      <Button
        variant="ghost"
        size="xs"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onBatchDelete}
        disabled={isMutating}
        title="Delete selected (Delete)"
      >
        <Trash2 className="h-3 w-3" />
        Delete selected
      </Button>
    </div>
  );
});
