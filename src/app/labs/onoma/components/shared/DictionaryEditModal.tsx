"use client";

// src/app/labs/onoma/components/shared/DictionaryEditModal.tsx
// Onoma — Edit a saved dictionary: rename + re-tag role/gender/category/set.

import { useState } from "react";
import { X, Loader2, Save } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { NAME_ROLES, NAME_GENDERS, type NameRole, type NameGender } from "~/lib/onoma/name-sets";

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
  isPublic: boolean;
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
    isPublic: boolean;
  }) => Promise<void>;
}

export function DictionaryEditModal({ dict, onClose, onSave }: Props) {
  const [title, setTitle] = useState(dict.title);
  const [category, setCategory] = useState(dict.category ?? "");
  const [role, setRole] = useState<NameRole>((dict.role as NameRole) ?? "given");
  const [gender, setGender] = useState<NameGender>((dict.gender as NameGender) ?? "any");
  const [setName, setSetName] = useState(dict.setName ?? "");
  const [isPublic, setIsPublic] = useState(dict.isPublic ?? false);
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
        isPublic,
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
            <Select value={role} onValueChange={(val) => setRole(val as NameRole)}>
              <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition-colors focus:outline-none">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
                {NAME_ROLES.map((r) => (
                  <SelectItem
                    key={r.value}
                    value={r.value}
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                  >
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">Gender</label>
            <Select value={gender} onValueChange={(val) => setGender(val as NameGender)}>
              <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition-colors focus:outline-none">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
                {NAME_GENDERS.map((g) => (
                  <SelectItem
                    key={g.value}
                    value={g.value}
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                  >
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Category
            </label>
            <Select
              value={category || "any"}
              onValueChange={(val) => setCategory(val === "any" ? "" : val)}
            >
              <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition-colors focus:outline-none">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
                <SelectItem
                  value="any"
                  className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                >
                  Any
                </SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem
                    key={c}
                    value={c}
                    className="focus:text-foreground text-xs capitalize focus:bg-[#0091ff]/10"
                  >
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        <div className="border-border/20 flex items-center justify-between border-t pt-3 pb-1">
          <div className="flex flex-col">
            <span className="text-foreground text-xs font-semibold">Public Sharing</span>
            <span className="text-muted-foreground text-[10px]">
              Allow other players to discover and clone this dictionary.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className={cn(
              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isPublic ? "bg-[#0091ff]" : "bg-secondary"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isPublic ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

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
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      </FacetCard>
    </div>
  );
}

export default DictionaryEditModal;
