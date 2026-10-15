"use client";

import { useState } from "react";
import { Text } from "iconoir-react";
import { api } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { EditorSection, SaveButton, TextField, useSaveHandlers } from "./EditorSection";
import { useEditor, useReportDirty } from "./editor-context";

const MAX_NAME = 100;

/** Whitespace-trimmed, inner runs as one space: the name the server saves. */
const normalize = (name: string) => name.trim().replace(/\s+/g, " ");

/**
 * Name: renaming moves the nation's page address, and the old address keeps working. Checked as
 * typed (after a pause) for another nation in the realm with the same name.
 */
export function NameSection({ name: savedName }: { name: string }) {
  const { countryId, getVersion } = useEditor();
  const [name, setName] = useState(savedName);
  const next = normalize(name);
  const dirty = next !== savedName;
  useReportDirty("name", "Name", dirty);

  const debounced = useDebounce(next, 400);
  const settled = debounced === next;
  const check = api.countries.checkNameAvailable.useQuery(
    { countryId, name: debounced },
    { enabled: dirty && debounced !== "" && debounced !== savedName, retry: false }
  );

  const localError =
    next === ""
      ? "Enter a name."
      : next.length > MAX_NAME
        ? `Use ${MAX_NAME} characters or fewer.`
        : null;
  const checking = dirty && !localError && (!settled || check.isFetching);
  const takenReason =
    dirty && settled && check.data && !check.data.available ? check.data.reason : null;
  const error = dirty ? (localError ?? takenReason) : null;
  const helper = checking
    ? "Checking the name…"
    : dirty && check.data?.available
      ? "Available. Your page address follows the new name and the old one keeps working."
      : "Unique in your realm. Renaming moves your page address; the old one redirects.";

  const handlers = useSaveHandlers({ saved: "Name saved", failed: "Could not save the name" });
  const utils = api.useUtils();
  const rename = api.countries.rename.useMutation({
    ...handlers,
    onSuccess: (result) => {
      handlers.onSuccess(result);
      // The sidebar and profile show the name too.
      void utils.users.getProfile.invalidate();
    },
  });

  return (
    <EditorSection
      id="name"
      title="Name"
      icon={<Text />}
      description="What your nation is called across IxStates."
    >
      <TextField
        id="editor-name"
        label="Name"
        value={name}
        onChange={setName}
        maxLength={MAX_NAME + 20}
        error={error}
        helper={helper}
      />
      <SaveButton
        label="Save name"
        dirty={dirty}
        invalid={!!error}
        pending={rename.isPending}
        blocked={checking}
        onSave={() => rename.mutate({ countryId, expectedUpdatedAt: getVersion(), name: next })}
      />
    </EditorSection>
  );
}
