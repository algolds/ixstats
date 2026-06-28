"use client";

// src/app/labs/onoma/components/shared/DictionaryEditModal.tsx
// Onoma — Edit a saved dictionary: rename + re-tag role/gender/category/set.

import { useState } from "react";
import { X, Loader2, Save } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import {
  NAME_ROLES,
  NAME_GENDERS,
  type NameRole,
  type NameGender,
} from "~/lib/onoma/name-sets";

const CATEGORIES = [
  "city",
  "province",
  "country",
  "person",
  "military",
  "organization",
  "geography",
  "culture",
  "ship",
];

export interface DictEditValue {
  id: string;
  title: string;
  values: string[];
  category: string | null;
  role: string | null;
  gender: string | null;
  setName: string | null;
}

interface Props {
  dict: DictEditValue;
  onClose: () => void;
  onSave: (next: {
    id: string;
    title: string;
    values: string[];
    category: string | null;
    role: string | null;
    gender: string | null;
    setName: string | null;
  }) => Promise<void>;
}

export function DictionaryEditModal({ dict, onClose, onSave }: Props) {
  const [title, setTitle] = useState(dict.title);
  const [category, setCategory] = useState(dict.category ?? "");
  const [role, setRole] = useState<NameRole>((dict.role as NameRole) ?? "given");
  const [gender, setGender] = useState<NameGender>((dict.gender as NameGender) ?? "any");
  const [setName, setSetName] = useState(dict.setName ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: dict.id,
        title: title.trim(),
        values: dict.values,
        category: category || null,
        role,
        gender,
        setName: setName.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save dictionary:", err);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <FacetCard
        className="border-border/40 bg-background w-full max-w-md space-y-4 border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-base font-bold">Edit Dictionary</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">Name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-1.5 text-sm focus:border-[#0091ff]/50 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as NameRole)}
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
            >
              {NAME_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as NameGender)}
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
            >
              {NAME_GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value="">Any</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Name Set
            </label>
            <input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Roman"
              list="onoma-existing-sets"
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
            />
          </div>
        </div>

        <p className="text-muted-foreground text-[10px]">
          Tag dictionaries into a Name Set with roles to generate full names in Studio.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="bg-secondary/40 text-foreground hover:bg-secondary/60 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-1 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#33a7ff] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </FacetCard>
    </div>
  );
}

export default DictionaryEditModal;
