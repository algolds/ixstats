"use client";
// src/app/(wiki-os)/util/protect/page.tsx
// Special:Protect — limit who can edit, move, upload to or create a page.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  AdminPage,
  ExpirySelect,
  FormField,
  RightGate,
  readableTitle,
} from "~/components/wiki-os/admin/AdminPage";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { expiryFromPreset, type ExpiryPreset } from "~/lib/wiki-os/page-admin-ui";

const ACTIONS = [
  { action: "edit", label: "Edit" },
  { action: "move", label: "Move" },
  { action: "upload", label: "Upload" },
  { action: "create", label: "Create (a page that does not exist yet)" },
] as const;
type Action = (typeof ACTIONS)[number]["action"];
type Level = "none" | "autoconfirmed" | "sysop";
type Expiry = ExpiryPreset | "keep";

const LEVELS: ReadonlyArray<{ value: Level; label: string }> = [
  { value: "none", label: "Everyone who can edit" },
  { value: "autoconfirmed", label: "Autoconfirmed users and administrators" },
  { value: "sysop", label: "Administrators only" },
];

const isLevel = (value: string): value is Level => LEVELS.some((level) => level.value === value);

export default function ProtectPagePage() {
  const title = readableTitle(useSearchParams().get("title") ?? "");
  const router = useRouter();
  const notify = useNotify();
  const [levels, setLevels] = useState<Record<Action, Level>>({
    edit: "none",
    move: "none",
    upload: "none",
    create: "none",
  });
  const [expiries, setExpiries] = useState<Record<Action, Expiry>>({
    edit: "infinite",
    move: "infinite",
    upload: "infinite",
    create: "infinite",
  });
  const [reason, setReason] = useState("");

  const current = api.wikios.getPageRestrictions.useQuery({ title }, { enabled: title !== "" });
  const existing = current.data?.restrictions;

  // Start from what the page has now: each protected row keeps its level and (by default) its expiry.
  useEffect(() => {
    if (!existing) return;
    for (const { action } of ACTIONS) {
      const level = existing.find((row) => row.action === action)?.level;
      if (level && isLevel(level)) {
        setLevels((prev) => ({ ...prev, [action]: level }));
        setExpiries((prev) => ({ ...prev, [action]: "keep" }));
      }
    }
  }, [existing]);

  const protect = api.wikios.protectPage.useMutation({
    onSuccess: (result) => {
      notify.success("Protection saved", `"${result.title}" has been updated.`);
      router.push(`/wiki/${encodeURIComponent(result.title.replace(/ /g, "_"))}`);
    },
    onError: (error) => notify.error("Protection failed", error.message),
  });

  const submit = () => {
    protect.mutate({
      title,
      reason,
      restrictions: ACTIONS.map(({ action }) => {
        const level = levels[action] === "none" ? null : levels[action];
        const kept = existing?.find((row) => row.action === action)?.expiresAt ?? null;
        const pick = expiries[action];
        return {
          action,
          level,
          expiresAt: level === null ? null : pick === "keep" ? kept : expiryFromPreset(pick),
        };
      }),
    });
  };

  return (
    <AdminPage
      title="Protect page"
      description="Choose who may edit, move, upload to or create this title. Protections can expire."
    >
      <RightGate right="protect">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormField label="Page" htmlFor="protect-title">
            <Input id="protect-title" value={title} readOnly />
          </FormField>

          {ACTIONS.map(({ action, label }) => {
            const isProtected = existing?.some((row) => row.action === action) ?? false;
            return (
              <fieldset key={action} className="border-border space-y-2 rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">{label}</legend>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={levels[action]}
                    onValueChange={(next) => {
                      if (isLevel(next)) setLevels((prev) => ({ ...prev, [action]: next }));
                    }}
                  >
                    <SelectTrigger
                      aria-label={`${label} protection level`}
                      className="w-full sm:w-72"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {levels[action] !== "none" && (
                    <ExpirySelect
                      value={expiries[action]}
                      allowKeep={isProtected}
                      onChange={(next) => setExpiries((prev) => ({ ...prev, [action]: next }))}
                    />
                  )}
                </div>
              </fieldset>
            );
          })}

          <div className="space-y-1.5">
            <Label htmlFor="protect-reason">Reason</Label>
            <Input
              id="protect-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!title || protect.isPending}>
            {protect.isPending ? "Saving…" : "Save protection"}
          </Button>
        </form>
      </RightGate>
    </AdminPage>
  );
}
