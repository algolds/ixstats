"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/** The founder links one of their corporate ThinkPages accounts; its #business posts become the company's press. */
export function CompanyPressControls({
  company,
  onDone,
}: {
  company: { id: string; name: string; thinkpagesAccountId: string | null };
  onDone: () => void;
}) {
  const notify = useNotify();
  const [picked, setPicked] = useState("");
  const accounts = api.thinkpages.getMyAccounts.useQuery();
  const corporate = (accounts.data ?? []).filter((a) => a.accountType === "corporate");
  const linked = corporate.find((a) => a.id === company.thinkpagesAccountId);
  const done = (title: string) => () => {
    notify.success(title, company.name);
    setPicked("");
    onDone();
  };
  const link = api.exchange.linkCompanyAccount.useMutation({
    onSuccess: done("Account linked"),
    onError: (e) => notify.error("Could not link the account", e.message),
  });
  const unlink = api.exchange.unlinkCompanyAccount.useMutation({
    onSuccess: done("Account unlinked"),
    onError: (e) => notify.error("Could not unlink the account", e.message),
  });

  return (
    <div className="border-separator space-y-2 border-t pt-3">
      <p className="text-footnote text-label font-medium">Press account</p>
      {company.thinkpagesAccountId ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-footnote text-label">
            {linked ? `@${linked.username}` : "A linked account"} speaks for {company.name}.
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate({ companyId: company.id })}
          >
            Unlink
          </Button>
        </div>
      ) : corporate.length === 0 ? (
        <p className="text-caption text-label-secondary">
          Make a corporate account on ThinkPages to post company news.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-56">
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger aria-label={`Press account for ${company.name}`}>
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {corporate.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!picked || link.isPending}
            onClick={() => link.mutate({ companyId: company.id, accountId: picked })}
          >
            Link account
          </Button>
        </div>
      )}
      <p className="text-caption text-label-secondary">
        Its public posts tagged #business appear in the company&apos;s news.
      </p>
    </div>
  );
}
