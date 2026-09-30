"use client";
// src/app/(wiki-os)/util/userrights/page.tsx
// Special:UserRights — see a user's groups and, for a bureaucrat, add or remove the ones they may change.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { AdminPage, ExpirySelect, FormField } from "~/components/wiki-os/admin/AdminPage";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { expiryFromPreset, type ExpiryPreset } from "~/lib/wiki-os/page-admin-ui";

export default function UserRightsPage() {
  const notify = useNotify();
  const utils = api.useUtils();
  const initial = useSearchParams().get("user") ?? "";
  const [input, setInput] = useState(initial);
  const [target, setTarget] = useState(initial.trim());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [expiry, setExpiry] = useState<ExpiryPreset>("infinite");
  const [reason, setReason] = useState("");

  const user = api.wikios.getUserPermissions.useQuery({ user: target }, { enabled: target !== "" });
  const data = user.data;
  const explicit = data?.explicitGroups.map((row) => row.group);
  const changeable = data?.changeableGroups ?? [];

  // Start from the memberships the user has now.
  useEffect(() => {
    setSelected(new Set(data?.explicitGroups.map((row) => row.group) ?? []));
  }, [data]);

  const save = api.wikios.setUserGroups.useMutation({
    onSuccess: (result) => {
      notify.success("Groups updated", `${result.target}'s groups were saved.`);
      void utils.wikios.getUserPermissions.invalidate({ user: target });
    },
    onError: (error) => notify.error("Could not change groups", error.message),
  });

  const submit = () => {
    const current = new Set(explicit ?? []);
    save.mutate({
      target: { wikiUsername: target },
      add: changeable.filter((group) => selected.has(group) && !current.has(group)),
      remove: changeable.filter((group) => !selected.has(group) && current.has(group)),
      expiresAt: expiryFromPreset(expiry),
      reason,
    });
  };

  const toggle = (group: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(group);
      else next.delete(group);
      return next;
    });

  return (
    <AdminPage
      title="User rights"
      description="A user's groups come from their IxStates role, automatic rules and memberships a bureaucrat grants here."
    >
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setTarget(input.trim());
        }}
      >
        <div className="flex-1">
          <FormField label="Wiki username" htmlFor="rights-user">
            <Input id="rights-user" value={input} onChange={(e) => setInput(e.target.value)} />
          </FormField>
        </div>
        <Button type="submit" variant="outline">
          Look up
        </Button>
      </form>

      {user.error && <p className="text-destructive text-sm">{user.error.message}</p>}

      {data && (
        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Groups of {data.username}</h2>
            <div className="flex flex-wrap gap-1.5">
              {data.groups
                .filter((group) => group !== "*")
                .map((group) => (
                  <Badge key={group} variant="secondary">
                    {group}
                  </Badge>
                ))}
            </div>
            {data.block && <p className="text-destructive text-sm">Currently blocked.</p>}
          </div>

          {changeable.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You cannot change user groups: that needs the bureaucrat group.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <div className="space-y-2">
                {changeable.map((group) => (
                  <Label key={group} className="gap-2">
                    <Checkbox
                      checked={selected.has(group)}
                      onCheckedChange={(checked) => toggle(group, checked === true)}
                    />
                    {group}
                  </Label>
                ))}
              </div>
              <FormField label="Expiry of added groups" htmlFor="rights-expiry">
                <ExpirySelect
                  id="rights-expiry"
                  value={expiry}
                  onChange={(next) => next !== "keep" && setExpiry(next)}
                />
              </FormField>
              <FormField label="Reason" htmlFor="rights-reason">
                <Input
                  id="rights-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </FormField>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save groups"}
              </Button>
            </form>
          )}
        </section>
      )}
    </AdminPage>
  );
}
