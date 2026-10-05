"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { createUrl } from "~/lib/utils";
import { ManageSection, type RealmManage } from "./ManageSection";

/** Embassies: propose one to another realm, answer proposals, close embassies. */
export function EmbassiesSection({ slug, manage }: { slug: string; manage: RealmManage }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: directory } = api.realms.directory.useQuery();
  const [target, setTarget] = useState("");
  const done = (message: string) => () => {
    notify.success(message);
    void utils.realms.region.invalidate();
  };
  const fail = (title: string) => (error: { message: string }) =>
    notify.error(title, error.message);
  const propose = api.realms.region.proposeEmbassy.useMutation({
    onSuccess: (result) => {
      setTarget("");
      done(result.status === "active" ? "Embassy opened" : "Embassy proposed")();
    },
    onError: fail("Could not propose"),
  });
  const respond = api.realms.region.respondEmbassy.useMutation({
    onSuccess: done("Answer sent"),
    onError: fail("Could not answer"),
  });
  const close = api.realms.region.closeEmbassy.useMutation({
    onSuccess: done("Embassy closed"),
    onError: fail("Could not close"),
  });

  const taken = new Set(manage.embassies.map((e) => e.partner.slug));
  const options = (directory ?? []).filter((r) => r.slug !== slug && !taken.has(r.slug));
  const busy = propose.isPending || respond.isPending || close.isPending;

  return (
    <ManageSection
      id="embassies"
      title="Embassies"
      description="Realms with an embassy are listed on each other's page, and board posts flagged for embassies show on the partner's board."
    >
      <div className="flex flex-col gap-4">
        {manage.embassies.length === 0 ? (
          <p className="text-label-secondary text-body">No embassies or proposals.</p>
        ) : (
          <ul className="divide-separator flex flex-col divide-y">
            {manage.embassies.map((embassy) => (
              <li
                key={embassy.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <Link
                    href={createUrl(`/r/${encodeURIComponent(embassy.partner.slug)}`)}
                    className="text-label text-body hover:underline"
                  >
                    {embassy.partner.name}
                  </Link>
                  <Badge variant={embassy.status === "active" ? "success" : "default"}>
                    {embassy.status === "active"
                      ? "Active"
                      : embassy.direction === "incoming"
                        ? "Proposed to you"
                        : "Awaiting answer"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {embassy.status === "proposed" && embassy.direction === "incoming" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          respond.mutate({ slug, embassyId: embassy.id, accept: true })
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          respond.mutate({ slug, embassyId: embassy.id, accept: false })
                        }
                      >
                        Decline
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => close.mutate({ slug, embassyId: embassy.id })}
                    >
                      {embassy.status === "active" ? "Close embassy" : "Withdraw"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!manage.archived && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-64" aria-label="Realm to propose an embassy to">
                <SelectValue placeholder="Choose a realm" />
              </SelectTrigger>
              <SelectContent>
                {options.map((realm) => (
                  <SelectItem key={realm.slug} value={realm.slug}>
                    {realm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!target || busy}
              onClick={() => propose.mutate({ slug, targetSlug: target })}
            >
              Propose embassy
            </Button>
          </div>
        )}
      </div>
    </ManageSection>
  );
}
