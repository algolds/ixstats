"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ManageSection } from "./ManageSection";
import { RealmWikitextEditor } from "./RealmWikitextEditor";

/**
 * The realm's rules, written like the factbook. They show on the Rules tab, and players confirm reading them
 * before they claim a nation. Saving empty text removes them.
 */
export function RulesSection({
  slug,
  rules,
}: {
  slug: string;
  rules: { wikitext: string; updatedAt: Date | null };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const save = api.realms.region.updateRules.useMutation({
    onSuccess: (_result, { wikitext }) => {
      notify.success(wikitext.trim() ? "Rules saved" : "Rules removed");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the rules", error.message),
  });

  return (
    <ManageSection
      id="rules"
      title="Rules"
      description={`Shown on the Rules tab. Players confirm they have read them before claiming a nation; leave empty for no rules.${
        rules.updatedAt ? ` Last saved ${new Date(rules.updatedAt).toLocaleDateString()}.` : ""
      }`}
    >
      <RealmWikitextEditor
        editorKey={`rules:${slug}`}
        editorTitle={`Realm rules ${slug}`}
        initialWikitext={rules.wikitext}
        saveLabel="Save rules"
        sourceLabel="Rules wikitext"
        saving={save.isPending}
        onSave={(wikitext) => save.mutate({ slug, wikitext })}
      />
    </ManageSection>
  );
}
