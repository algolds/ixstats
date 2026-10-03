"use client";

// src/app/labs/onoma/components/shared/DictionaryEditModal.tsx
// Onoma — Edit a saved dictionary: rename + re-tag role/gender/category/set.

import { useState } from "react";
import { SystemRestart as Loader2, FloppyDisk as Save } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { NAME_ROLES, NAME_GENDERS, type NameRole, type NameGender } from "~/lib/onoma/name-sets";
import { Input } from "~/components/ui/input";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit dictionary</DialogTitle>
          <DialogDescription className="sr-only">
            Rename this dictionary and re-tag its role, gender, category and name set.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <label className="text-label-secondary text-subhead">Name</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-body w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Role</label>
            <Select value={role} onValueChange={(val) => setRole(val as NameRole)}>
              <SelectTrigger className="text-footnote w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {NAME_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-footnote">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Gender</label>
            <Select value={gender} onValueChange={(val) => setGender(val as NameGender)}>
              <SelectTrigger className="text-footnote w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {NAME_GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value} className="text-footnote">
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Category</label>
            <Select
              value={category || "any"}
              onValueChange={(val) => setCategory(val === "any" ? "" : val)}
            >
              <SelectTrigger className="text-footnote w-full">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="max-h-[250px]">
                <SelectItem value="any" className="text-footnote">
                  Any
                </SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-footnote capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Name set</label>
            <Input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Roman"
              list="onoma-existing-sets"
              className="text-footnote w-full"
            />
          </div>
        </div>

        <p className="text-label-secondary text-caption">
          Tag dictionaries into a Name Set with roles to generate full names in Studio.
        </p>

        <div className="border-separator flex items-center justify-between border-t pt-3 pb-1">
          <div className="flex flex-col">
            <span className="text-label text-footnote font-semibold">Public sharing</span>
            <span className="text-label-secondary text-caption">
              Allow other players to discover and clone this dictionary.
            </span>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Public sharing" />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
