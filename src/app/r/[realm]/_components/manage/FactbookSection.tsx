"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ManageSection } from "./ManageSection";
import { RealmWikitextEditor } from "./RealmWikitextEditor";

/** The factbook, written with the WikiOS canvas editor (or as wikitext source). */
export function FactbookSection({
  slug,
  realmName,
  factbook,
}: {
  slug: string;
  realmName: string;
  factbook: { wikitext: string; updatedAt: Date | null };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const save = api.realms.region.updateFactbook.useMutation({
    onSuccess: () => {
      notify.success("Factbook saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the factbook", error.message),
  });

  return (
    <ManageSection
      id="factbook"
      title="Factbook"
      description={`What visitors read first on ${realmName}'s page.${
        factbook.updatedAt
          ? ` Last saved ${new Date(factbook.updatedAt).toLocaleDateString()}.`
          : ""
      }`}
    >
      <RealmWikitextEditor
        editorKey={`factbook:${slug}`}
        editorTitle={`Realm factbook ${slug}`}
        initialWikitext={factbook.wikitext}
        saveLabel="Save factbook"
        sourceLabel="Factbook wikitext"
        saving={save.isPending}
        onSave={(wikitext) => save.mutate({ slug, wikitext })}
      />
    </ManageSection>
  );
}
