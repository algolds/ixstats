"use client";

import { useState } from "react";
import { Bank } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { GOVERNMENT_FORMS, type GovernmentForm } from "~/lib/government/forms";
import { EditorSection, SaveButton, TextField, useDraft, useSaveHandlers } from "./EditorSection";
import { useEditor, useReportDirty } from "./editor-context";

export interface GovernmentFormState {
  governmentType: string | null;
  headOfState: string | null;
  headOfGovernment: string | null;
  legislatureName: string | null;
  executiveName: string | null;
  judicialName: string | null;
}

const INSTITUTION_FIELDS = [
  {
    key: "headOfState",
    label: "Head of state",
    helper: "The title, such as President or King.",
    title: (f: GovernmentForm) => f.institutions.headOfStateTitle,
  },
  {
    key: "headOfGovernment",
    label: "Head of government",
    helper: "The title of who runs the government, such as Prime Minister.",
    title: (f: GovernmentForm) => f.institutions.headOfGovernmentTitle,
  },
  {
    key: "legislatureName",
    label: "Legislature",
    helper: "The body that makes laws, such as Parliament.",
    title: (f: GovernmentForm) => f.institutions.legislatureName,
  },
  {
    key: "executiveName",
    label: "Executive",
    helper: "The body that runs ministries, such as the Cabinet.",
    title: (f: GovernmentForm) => f.institutions.executiveName,
  },
  {
    key: "judicialName",
    label: "Judiciary",
    helper: "The highest court.",
    title: (f: GovernmentForm) => f.institutions.judicialName,
  },
] as const;

type InstitutionKey = (typeof INSTITUTION_FIELDS)[number]["key"];

/** The form whose government type is the stored one, ignoring case. */
function formFor(governmentType: string): GovernmentForm | undefined {
  const type = governmentType.trim().toLowerCase();
  return GOVERNMENT_FORMS.find((f) => f.governmentType.toLowerCase() === type);
}

/**
 * Form and institutions: one of the government forms (it sets the government type) and the
 * names of the institutions. Picking a form offers its usual titles; nothing is replaced until
 * the player applies them.
 */
export function GovernmentFormSection({ government }: { government: GovernmentFormState }) {
  const { countryId } = useEditor();
  const draft = useDraft({
    governmentType: government.governmentType ?? "",
    headOfState: government.headOfState ?? "",
    headOfGovernment: government.headOfGovernment ?? "",
    legislatureName: government.legislatureName ?? "",
    executiveName: government.executiveName ?? "",
    judicialName: government.judicialName ?? "",
  });
  useReportDirty("form", "Form and institutions", draft.dirty);
  const [offerFor, setOfferFor] = useState<GovernmentForm | null>(null);

  const selected = formFor(draft.values.governmentType);
  const typeError = draft.values.governmentType.trim() === "" ? "Pick a form of government." : null;
  const offerDiffers =
    offerFor && INSTITUTION_FIELDS.some((f) => draft.values[f.key] !== f.title(offerFor));

  const handlers = useSaveHandlers({
    saved: "Government saved",
    failed: "Could not save the government",
    apply: (state, result: GovernmentFormState & { governmentType: string }) => {
      const { governmentType, ...names } = result;
      return {
        ...state,
        governmentType,
        governmentStructure: {
          governmentEffectiveness: state.governmentStructure?.governmentEffectiveness ?? null,
          ...state.governmentStructure,
          governmentType,
          ...names,
        },
      };
    },
  });
  const save = api.countries.saveGovernmentForm.useMutation(handlers);

  return (
    <EditorSection
      id="form"
      title="Form and institutions"
      icon={<Bank />}
      description="How your nation is governed and what its institutions are called."
    >
      <div className="flex flex-col gap-2">
        <p id="editor-form-label" className="text-label text-subhead font-medium">
          Form of government
        </p>
        {!selected && government.governmentType && (
          <p className="text-label-secondary text-footnote">
            Your government type, {government.governmentType}, is not one of these forms. It stays
            until you pick one.
          </p>
        )}
        <RadioCardGroup
          aria-labelledby="editor-form-label"
          aria-invalid={typeError ? true : undefined}
          columns={2}
          value={selected?.id ?? null}
          onValueChange={(id) => {
            const form = GOVERNMENT_FORMS.find((f) => f.id === id);
            if (!form) return;
            draft.set("governmentType", form.governmentType);
            setOfferFor(form);
          }}
        >
          {GOVERNMENT_FORMS.map((form) => (
            <RadioCard
              key={form.id}
              value={form.id}
              title={form.name}
              description={form.description}
              className="min-h-11"
            />
          ))}
        </RadioCardGroup>
      </div>

      {offerFor && offerDiffers && (
        <div className="bg-fill-4 rounded-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <p className="text-callout text-label flex-1">
            Use the usual titles of a {offerFor.name.toLowerCase()}:{" "}
            {offerFor.institutions.headOfStateTitle}, {offerFor.institutions.headOfGovernmentTitle},{" "}
            {offerFor.institutions.legislatureName}?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                draft.setMany(
                  Object.fromEntries(INSTITUTION_FIELDS.map((f) => [f.key, f.title(offerFor)]))
                );
                setOfferFor(null);
              }}
            >
              Use these titles
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOfferFor(null)}>
              Keep mine
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {INSTITUTION_FIELDS.map((f) => (
          <TextField
            key={f.key}
            id={`editor-${f.key}`}
            label={f.label}
            helper={f.helper}
            maxLength={120}
            value={draft.values[f.key]}
            onChange={(value) => draft.set(f.key as InstitutionKey, value)}
          />
        ))}
      </div>

      <SaveButton
        section="form"
        label="Save government"
        dirty={draft.dirty}
        invalid={!!typeError}
        pending={save.isPending}
        onSave={() =>
          save.mutate({
            countryId,
            governmentType: draft.values.governmentType.trim(),
            expected: government,
            ...(Object.fromEntries(
              INSTITUTION_FIELDS.map((f) => [f.key, draft.values[f.key].trim() || null])
            ) as Record<InstitutionKey, string | null>),
          })
        }
      />
    </EditorSection>
  );
}
