"use client";

import { api } from "~/trpc/react";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { isRealmImageUrl } from "~/lib/realms/realm-region";
import {
  EDITOR_IDENTITY_KEYS,
  IDENTITY_FIELDS,
  identityFieldError,
  type EditorCountryImageKey,
  type EditorIdentityKey,
  type IdentityFieldSpec,
  type IdentitySectionId,
} from "~/lib/mycountry/editor-fields";
import { RealmImageField } from "~/app/r/[realm]/_components/manage/RealmImageField";
import { EditorSection, SaveButton, TextField, useDraft, useSaveHandlers } from "./EditorSection";
import { useEditor, useReportDirty, type EditorState } from "./editor-context";

type Values = Record<string, string>;

interface IdentitySaveResult {
  identity: Partial<Record<EditorIdentityKey, string | null>>;
  flag?: string | null;
  coatOfArms?: string | null;
}

const EMPTY_IDENTITY = Object.fromEntries(EDITOR_IDENTITY_KEYS.map((key) => [key, null]));

const IMAGE_FIELDS: Array<{ key: EditorCountryImageKey; label: string; preview: string }> = [
  { key: "flag", label: "Flag", preview: "h-16 w-auto max-w-40" },
  { key: "coatOfArms", label: "Coat of arms", preview: "size-20" },
];

function ChoiceField({
  spec,
  value,
  onChange,
  error,
}: {
  spec: IdentityFieldSpec;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const id = `editor-${spec.key}`;
  const note = error ?? spec.helper;
  return (
    <div className="flex flex-col gap-2">
      <Label id={`${id}-label`}>{spec.label}</Label>
      <SegmentedControl
        aria-labelledby={`${id}-label`}
        aria-describedby={note ? `${id}-note` : undefined}
        options={(spec.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
        value={value.toLowerCase() || undefined}
        onValueChange={onChange}
        className="w-full sm:w-auto"
      />
      {note && (
        <p
          id={`${id}-note`}
          aria-live={error ? "polite" : undefined}
          className={
            error ? "text-destructive text-footnote" : "text-label-secondary text-footnote"
          }
        >
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * An identity section (Flag and symbols, Capital and language, Culture, Civic standards): its
 * national identity fields, plus the flag and coat of arms in Flag and symbols. Saves only the
 * fields that changed.
 */
export function IdentitySection({
  sectionId,
  title,
  description,
  icon,
  saveLabel,
  identity,
  images,
}: {
  sectionId: IdentitySectionId;
  title: string;
  description: string;
  icon: React.ReactNode;
  saveLabel: string;
  identity: Partial<Record<EditorIdentityKey, string | null>> | null;
  /** The flag and coat of arms, for the section that shows them. */
  images?: Record<EditorCountryImageKey, string | null>;
}) {
  const { countryId } = useEditor();
  const fields = IDENTITY_FIELDS[sectionId];
  const initial: Values = Object.fromEntries([
    ...fields.map((f) => [f.key, identity?.[f.key] ?? ""]),
    ...(images ? IMAGE_FIELDS.map((f) => [f.key, images[f.key] ?? ""]) : []),
  ]);
  const draft = useDraft(initial);
  useReportDirty(sectionId, title, draft.dirty);

  const errorOf = (key: string): string | null => {
    // Only what the player changed is checked: a stored value saves as it is.
    if (!draft.changed.includes(key)) return null;
    const value = draft.values[key] ?? "";
    if (key === "flag" || key === "coatOfArms") {
      return isRealmImageUrl(value)
        ? null
        : "Use an https:// image address, upload an image or pick one from the repository.";
    }
    return identityFieldError(key as EditorIdentityKey, value);
  };
  const invalid = draft.changed.some((key) => errorOf(key));

  const handlers = useSaveHandlers({
    saved: `${title} saved`,
    failed: `Could not save ${title.toLowerCase()}`,
    apply: (state, result: IdentitySaveResult) => ({
      ...state,
      ...(result.flag !== undefined && { flag: result.flag }),
      ...(result.coatOfArms !== undefined && { coatOfArms: result.coatOfArms }),
      nationalIdentity: {
        ...EMPTY_IDENTITY,
        ...state.nationalIdentity,
        ...result.identity,
      } as EditorState["nationalIdentity"],
    }),
  });
  const save = api.countries.saveIdentity.useMutation(handlers);

  const onSave = () => {
    const identityPatch: Partial<Record<EditorIdentityKey, string | null>> = {};
    const imagePatch: Partial<Record<EditorCountryImageKey, string | null>> = {};
    // What the page loaded for exactly the fields being changed: the server refuses only if one
    // of those moved since.
    const expectedIdentity: Record<string, string | null> = {};
    const expectedImages: Partial<Record<EditorCountryImageKey, string | null>> = {};
    for (const key of draft.changed) {
      const value = draft.values[key]!.trim() || null;
      const loaded = initial[key]?.trim() || null;
      if (key === "flag" || key === "coatOfArms") {
        imagePatch[key] = value;
        expectedImages[key] = loaded;
      } else {
        identityPatch[key as EditorIdentityKey] = value;
        expectedIdentity[key] = loaded;
      }
    }
    save.mutate({
      countryId,
      section: sectionId,
      identity: identityPatch,
      ...imagePatch,
      expected: { identity: expectedIdentity, ...expectedImages },
    });
  };

  return (
    <EditorSection id={sectionId} title={title} icon={icon} description={description}>
      {images &&
        IMAGE_FIELDS.map((f) => (
          <RealmImageField
            key={f.key}
            id={`editor-${f.key}`}
            label={f.label}
            value={draft.values[f.key] ?? ""}
            onChange={(value) => draft.set(f.key, value)}
            previewClassName={f.preview}
            // A stored image from before the address check stays valid until it is replaced.
            valid={!draft.changed.includes(f.key) || isRealmImageUrl(draft.values[f.key] ?? "")}
          />
        ))}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((spec) =>
          spec.options ? (
            <ChoiceField
              key={spec.key}
              spec={spec}
              value={draft.values[spec.key] ?? ""}
              onChange={(value) => draft.set(spec.key, value)}
              error={errorOf(spec.key)}
            />
          ) : (
            <TextField
              key={spec.key}
              id={`editor-${spec.key}`}
              label={spec.label}
              value={draft.values[spec.key] ?? ""}
              placeholder={spec.placeholder}
              helper={spec.helper}
              error={errorOf(spec.key)}
              onChange={(value) =>
                draft.set(
                  spec.key,
                  spec.transform === "upper"
                    ? value.toUpperCase()
                    : spec.transform === "lower"
                      ? value.toLowerCase()
                      : value
                )
              }
            />
          )
        )}
      </div>
      <SaveButton
        section={sectionId}
        label={saveLabel}
        dirty={draft.dirty}
        invalid={invalid}
        pending={save.isPending}
        onSave={onSave}
      />
    </EditorSection>
  );
}
