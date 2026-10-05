"use client";

// src/app/labs/onoma/components/sections/MyLanguagePacksPanel.tsx
// Onoma Lab: the signed-in user's own language packs (SL-18). Start a draft pack from name bank
// dictionaries, then publish it to the marketplace (or unlisted) or take it back to draft.

import { useMemo, useState } from "react";
import { Plus, Upload, EyeClosed, WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { PACK_PUBLISH_RULES } from "~/lib/onoma/pack-publish";

const VISIBILITY_LABEL: Record<string, string> = {
  draft: "Draft",
  public: "Published",
  unlisted: "Unlisted",
};

function NewPackForm({ onCreated }: { onCreated: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: dictionaries, isLoading } = api.onoma.getNameBank.useQuery({
    type: "dictionary",
  });
  const usable = useMemo(
    () => (dictionaries ?? []).filter((d) => Array.isArray(d.values) && d.values.length > 0),
    [dictionaries]
  );

  const create = api.onoma.createPack.useMutation({
    onSuccess: () => {
      notify.success("Draft pack created. Publish it when it is ready.");
      setName("");
      setDescription("");
      setSelected(new Set());
      onCreated();
    },
    onError: (err) => notify.error(err.message || "Could not create the pack"),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () =>
    create.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      dictionaries: usable
        .filter((d) => selected.has(d.id))
        .map((d) => ({
          name: d.title,
          category: d.category,
          values: d.values.slice(0, PACK_PUBLISH_RULES.maxDictionaryEntries),
        })),
    });

  return (
    <div className="border-separator space-y-3 border-t pt-4">
      <p className="text-label text-footnote font-semibold">New pack from your dictionaries</p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pack name"
        maxLength={PACK_PUBLISH_RULES.nameMax}
        className="text-footnote"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={`Description (at least ${PACK_PUBLISH_RULES.descriptionMin} characters to publish)`}
        maxLength={PACK_PUBLISH_RULES.descriptionMax}
        className="text-footnote min-h-16"
      />
      {isLoading ? (
        <p className="text-label-secondary text-footnote">Loading your dictionaries...</p>
      ) : usable.length === 0 ? (
        <p className="text-label-secondary text-footnote">
          Save a dictionary in the name bank first; packs are built from your dictionaries.
        </p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {usable.map((d) => (
            <li key={d.id}>
              <label className="text-label text-footnote flex items-center gap-2">
                <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                <span className="truncate">{d.title}</span>
                <span className="text-label-secondary tabular-nums">{d.values.length}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <Button
          size="sm"
          type="button"
          onClick={submit}
          disabled={
            create.isPending ||
            name.trim().length < PACK_PUBLISH_RULES.nameMin ||
            selected.size === 0 ||
            selected.size > PACK_PUBLISH_RULES.maxDictionaries
          }
        >
          <Plus aria-hidden="true" />
          Create draft
        </Button>
      </div>
    </div>
  );
}

export function MyLanguagePacksPanel() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [showForm, setShowForm] = useState(false);
  const { data: packs, isLoading } = api.onoma.myPacks.useQuery();

  const refresh = () => {
    void utils.onoma.myPacks.invalidate();
    void utils.onoma.list.invalidate();
  };
  const publish = api.onoma.publishPack.useMutation({
    onSuccess: (pack) => {
      notify.success(
        pack.visibility === "public" ? "Pack published to the marketplace" : "Pack shared unlisted"
      );
      refresh();
    },
    onError: (err) => notify.error(err.message || "Could not publish the pack"),
  });
  const unpublish = api.onoma.unpublishPack.useMutation({
    onSuccess: () => {
      notify.success("Pack moved back to draft");
      refresh();
    },
    onError: (err) => notify.error(err.message || "Could not unpublish the pack"),
  });
  const busy = publish.isPending || unpublish.isPending;

  return (
    <Card variant="well" padding="none" className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-label text-headline">My packs</h3>
          <p className="text-label-secondary text-footnote">
            Drafts are private. Publish a pack to list it in the community marketplace.
          </p>
        </div>
        <Button size="sm" variant="outline" type="button" onClick={() => setShowForm((v) => !v)}>
          <Plus aria-hidden="true" />
          {showForm ? "Close" : "New pack"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-label-secondary text-footnote">Loading your packs...</p>
      ) : !packs?.length ? (
        <p className="text-label-secondary text-footnote">
          You have no packs yet. Start one from your dictionaries, or fork a community pack.
        </p>
      ) : (
        <ul className="space-y-3">
          {packs.map((pack) => {
            const isDraft = pack.visibility === "draft";
            const blocked = pack.publishProblems.length > 0;
            return (
              <li
                key={pack.id}
                className="border-separator bg-surface rounded-card space-y-2 border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-label text-callout truncate font-semibold">
                      {pack.name}
                    </span>
                    <Badge variant={isDraft ? "default" : "success"}>
                      {VISIBILITY_LABEL[pack.visibility] ?? pack.visibility}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {isDraft ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          disabled={busy || blocked}
                          onClick={() =>
                            publish.mutate({ packId: pack.id, visibility: "unlisted" })
                          }
                        >
                          Share unlisted
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          disabled={busy || blocked}
                          onClick={() => publish.mutate({ packId: pack.id, visibility: "public" })}
                        >
                          <Upload aria-hidden="true" />
                          Publish
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={busy}
                        onClick={() => unpublish.mutate({ packId: pack.id })}
                      >
                        <EyeClosed aria-hidden="true" />
                        Unpublish
                      </Button>
                    )}
                  </div>
                </div>
                {isDraft && blocked && (
                  <ul className="text-label-secondary text-footnote space-y-1">
                    {pack.publishProblems.map((problem) => (
                      <li key={problem} className="flex items-start gap-2">
                        <WarningTriangle className="text-orange mt-0.5 size-3.5 shrink-0" />
                        {problem}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <NewPackForm
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
    </Card>
  );
}
