"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle } from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  BRANCH_DOMAINS,
  DOMAIN_LABELS,
  FORCE_LIMITS,
  type BranchDomain,
} from "~/lib/military/force-structure";
import { CountField, TextField, type ForceBranch } from "./force-fields";

/** A branch's identity; its headcount, equipment and readiness come from the defense budget. */
export interface BranchFormData {
  domain: BranchDomain;
  name: string;
  motto: string;
  description: string;
  established: string;
  civilianStaff: number;
}

/** A starter name for a domain until the player names the branch. */
const DEFAULT_NAMES: Record<BranchDomain, string> = {
  land: "Army",
  sea: "Navy",
  air: "Air force",
  marines: "Marines",
  space: "Space force",
  strategic_missile: "Strategic missile force",
};

function toForm(branch: ForceBranch | null): BranchFormData {
  return {
    domain: branch?.domain ?? "land",
    name: branch?.name ?? DEFAULT_NAMES.land,
    motto: branch?.motto ?? "",
    description: branch?.description ?? "",
    established: branch?.established ?? "",
    civilianStaff: branch?.civilianStaff ?? 0,
  };
}

interface BranchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: ForceBranch | null;
  pending: boolean;
  onSubmit: (data: BranchFormData) => void;
}

/** Create or edit a military branch's identity. Its strength grows from the defense budget on the realm clock. */
export function BranchSheet({ open, onOpenChange, branch, pending, onSubmit }: BranchSheetProps) {
  const [form, setForm] = useState<BranchFormData>(() => toForm(branch));

  useEffect(() => {
    // oxlint-disable-next-line
    if (open) setForm(toForm(branch));
  }, [branch, open]);

  const set = <K extends keyof BranchFormData>(key: K, value: BranchFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{branch ? `Edit ${branch.name}` : "New military branch"}</SheetTitle>
          <SheetDescription>
            Personnel, equipment and readiness grow from your defense budget. A new branch starts
            empty.
          </SheetDescription>
        </SheetHeader>

        <form
          id="branch-form"
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch-domain">Domain</Label>
                <Select
                  value={form.domain}
                  disabled={!!branch}
                  onValueChange={(value) => {
                    const next = value as BranchDomain;
                    setForm((prev) => ({
                      ...prev,
                      domain: next,
                      // Follow the domain's default name until the player names the branch.
                      name: prev.name === DEFAULT_NAMES[prev.domain] ? DEFAULT_NAMES[next] : prev.name,
                    }));
                  }}
                >
                  <SelectTrigger id="branch-domain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCH_DOMAINS.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {DOMAIN_LABELS[domain]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField
                id="branch-name"
                label="Name"
                value={form.name}
                maxLength={100}
                placeholder="e.g. Royal Navy"
                onChange={(v) => set("name", v)}
              />
              <TextField
                id="branch-motto"
                label="Motto (optional)"
                value={form.motto}
                maxLength={200}
                onChange={(v) => set("motto", v)}
              />
              <TextField
                id="branch-established"
                label="Established (optional)"
                value={form.established}
                maxLength={50}
                placeholder="e.g. 1802"
                onChange={(v) => set("established", v)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-description">Description (optional)</Label>
              <Textarea
                id="branch-description"
                value={form.description}
                maxLength={2000}
                rows={3}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <CountField
              id="branch-civilians"
              label="Civilian staff"
              value={form.civilianStaff}
              max={FORCE_LIMITS.maxCivilianStaff}
              onChange={(v) => set("civilianStaff", v)}
            />
          </section>
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="branch-form" disabled={pending || !form.name.trim()}>
            <CheckCircle aria-hidden="true" className="h-4 w-4" />
            {pending ? "Saving..." : branch ? "Save branch" : "Create branch"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
