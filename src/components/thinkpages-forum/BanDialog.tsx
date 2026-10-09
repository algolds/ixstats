"use client";

import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";
import { FormError, ReasonField } from "./ReasonField";

type BanScopeInput = RouterInputs["thinkpagesForumMod"]["ban"]["scope"];
type ModContext = RouterOutputs["thinkpagesForumMod"]["context"];

export interface BanScopeOption {
  value: string;
  label: string;
  scope: BanScopeInput;
}

/** Where a category sits, as thread reads return it. */
export interface PlacedCategory {
  key: string;
  name: string;
  realm: { slug: string; name: string } | null;
}

/**
 * The places the viewer may ban a member from, seen from a category: the category itself, its realm's section when
 * they moderate the realm, and the whole forum for site admins only (the server refuses anything else).
 */
export function banScopeOptions(
  category: PlacedCategory,
  context: ModContext | undefined
): BanScopeOption[] {
  const { realm } = category;
  const admin = context?.isSiteAdmin === true;
  // The category's realm, when the viewer moderates its whole section.
  const realmScope =
    realm && (admin || context?.realms.some((r) => r.slug === realm.slug)) ? realm : null;
  return [
    {
      value: "category",
      label: category.name,
      scope: { kind: "category", key: category.key, ...(realm ? { realm: realm.slug } : {}) },
    },
    ...(realmScope
      ? [
          {
            value: "realm",
            label: `${realmScope.name} forum`,
            scope: { kind: "realm" as const, realm: realmScope.slug },
          },
        ]
      : []),
    ...(admin
      ? [{ value: "site", label: "The whole forum", scope: { kind: "site" as const } }]
      : []),
  ];
}

const DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "permanent", label: "Permanent" },
  { value: "custom", label: "Custom days" },
] as const;
const MAX_DAYS = 3650;
const REASON_MAX = 1000;

/** The ban's length in days (null: permanent), or undefined while a custom length is not a whole 1 to 3650. */
function daysOf(duration: string, custom: string): number | null | undefined {
  if (duration === "permanent") return null;
  const days = Number(duration === "custom" ? custom : duration);
  return Number.isInteger(days) && days >= 1 && days <= MAX_DAYS ? days : undefined;
}

interface BanDialogProps {
  userId: string;
  scopes: readonly BanScopeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ban a member from a place the viewer moderates, for a while or until lifted. */
export function BanDialog({ userId, scopes, open, onOpenChange }: BanDialogProps) {
  const notify = useNotify();
  const scopeId = useId();
  const durationId = useId();
  const [scope, setScope] = useState(scopes[0]?.value ?? "category");
  const [duration, setDuration] = useState("7");
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: ban, isPending } = api.thinkpagesForumMod.ban.useMutation();
  const chosen = scopes.find((s) => s.value === scope) ?? scopes[0];
  const days = daysOf(duration, custom);
  const length = reason.trim().length;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setError(null);
  };

  const send = () => {
    if (!chosen || days === undefined) return;
    setError(null);
    ban({ userId, scope: chosen.scope, reason: reason.trim(), days })
      .then(() => {
        notify.success("Member banned");
        setReason("");
        close(false);
      })
      .catch((e: Error) => setError(e.message || "Could not ban this member."));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ban this member</DialogTitle>
          <DialogDescription>
            They can still read, but cannot post, reply or edit where they are banned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label id={scopeId}>Banned from</Label>
          <Select value={chosen?.value} onValueChange={setScope} disabled={isPending}>
            <SelectTrigger aria-labelledby={scopeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label id={durationId}>Length</Label>
          <Select value={duration} onValueChange={setDuration} disabled={isPending}>
            <SelectTrigger aria-labelledby={durationId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {duration === "custom" ? (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DAYS}
              aria-label="Days"
              placeholder="Days, 1 to 3650"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              disabled={isPending}
            />
          ) : null}
        </div>
        <ReasonField
          label="Reason"
          value={reason}
          onChange={setReason}
          max={REASON_MAX}
          disabled={isPending}
        />
        <FormError message={error} />
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={send}
            disabled={
              isPending || !chosen || days === undefined || length === 0 || length > REASON_MAX
            }
          >
            Ban
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
