"use client";

import { useState } from "react";
import { Xmark } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  isRealmLinkUrl,
  MAX_REALM_LINK_LABEL,
  MAX_REALM_LINK_URL,
  MAX_REALM_LINKS,
  REALM_LINK_KIND_LABELS,
  REALM_LINK_KINDS,
  type RealmLink,
  type RealmLinkKind,
} from "~/lib/realms/realm-community";
import { ManageSection } from "./ManageSection";

/** Community links (forum, Discord, wiki, map, website) shown in the Community panel of the realm page. */
export function LinksSection({ slug, links }: { slug: string; links: RealmLink[] }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [rows, setRows] = useState<RealmLink[]>(links);
  const save = api.realms.region.updateLinks.useMutation({
    onSuccess: () => {
      notify.success("Links saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the links", error.message),
  });
  const update = (index: number, patch: Partial<RealmLink>) =>
    setRows((all) => all.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const badUrl = (row: RealmLink) => row.url.trim() !== "" && !isRealmLinkUrl(row.url);
  const complete = rows.every((row) => row.label.trim() !== "" && isRealmLinkUrl(row.url));

  return (
    <ManageSection
      id="links"
      title="Community links"
      description={`Your forum, Discord, wiki, map or website, in the realm page's Community panel (up to ${MAX_REALM_LINKS}). Full https:// addresses only.`}
    >
      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-label-secondary text-footnote">No links yet.</p>
        )}
        {rows.map((row, index) => (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={row.kind}
                onValueChange={(kind) => update(index, { kind: kind as RealmLinkKind })}
              >
                <SelectTrigger size="sm" className="w-32" aria-label={`Link ${index + 1} kind`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REALM_LINK_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {REALM_LINK_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={row.label}
                onChange={(e) => update(index, { label: e.target.value })}
                maxLength={MAX_REALM_LINK_LABEL}
                placeholder="Label"
                aria-label={`Link ${index + 1} label`}
                className="w-40"
              />
              <Input
                value={row.url}
                onChange={(e) => update(index, { url: e.target.value })}
                maxLength={MAX_REALM_LINK_URL}
                placeholder="https://"
                aria-label={`Link ${index + 1} address`}
                aria-invalid={badUrl(row) || undefined}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove link ${index + 1}`}
                onClick={() => setRows((all) => all.filter((_, i) => i !== index))}
              >
                <Xmark aria-hidden="true" />
              </Button>
            </div>
            {badUrl(row) && (
              <p className="text-destructive text-footnote">Use a full https:// address.</p>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {rows.length < MAX_REALM_LINKS && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRows((all) => [...all, { label: "", url: "", kind: "forum" }])}
            >
              Add link
            </Button>
          )}
          <Button
            size="sm"
            disabled={!complete || save.isPending}
            onClick={() =>
              save.mutate({
                slug,
                links: rows.map((row) => ({ ...row, label: row.label.trim(), url: row.url.trim() })),
              })
            }
          >
            Save links
          </Button>
        </div>
      </div>
    </ManageSection>
  );
}
