"use client";

import { forwardRef } from "react";
import { NavArrowDown, ProfileCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { FieldErrors, FoundingIdentity, IdentityFieldId } from "../lib/founding-draft";
import { FlagField } from "./FlagField";
import { Field, StepCard, fieldAria } from "./StepCard";

type TextFieldId = Exclude<IdentityFieldId, "flagUrl" | "drivingSide" | "weekStartDay">;

interface TextField {
  id: TextFieldId;
  label: string;
  helper: string;
  placeholder?: string;
  required?: boolean;
}

const ESSENTIALS: TextField[] = [
  {
    id: "name",
    label: "Name",
    helper: "What your nation is called on maps, in lists and on its page.",
    required: true,
  },
  { id: "capitalCity", label: "Capital city", helper: "Where the government sits." },
  {
    id: "officialLanguages",
    label: "Official language",
    helper: "Separate several with commas.",
  },
  { id: "currency", label: "Currency", helper: "The name of your money, like Crown or Dinar." },
  { id: "motto", label: "Motto", helper: "Optional. A short line your nation lives by." },
];

const MORE_DETAILS: TextField[] = [
  {
    id: "officialName",
    label: "Official name",
    helper: "The formal name, like Kingdom of Example.",
  },
  { id: "demonym", label: "Demonym", helper: "What your people are called, like Examplish." },
  { id: "nationalAnimal", label: "National animal", helper: "An animal your nation is known for." },
  { id: "nationalFlower", label: "National flower", helper: "A flower your nation is known for." },
  { id: "nationalReligion", label: "Religion", helper: "The main or official faith, if any." },
  { id: "nationalAnthem", label: "Anthem", helper: "The name of your national anthem." },
  {
    id: "callingCode",
    label: "Calling code",
    helper: "The phone prefix, like +33.",
    placeholder: "+",
  },
  {
    id: "internetTLD",
    label: "Internet domain",
    helper: "Your web ending, like .fr.",
    placeholder: ".",
  },
  { id: "isoCode", label: "Country code", helper: "Two or three letters, like FR." },
];

/** Identity fields shown only inside "More details". */
export const MORE_DETAIL_FIELD_IDS: readonly IdentityFieldId[] = [
  ...MORE_DETAILS.map((field) => field.id),
  "drivingSide",
  "weekStartDay",
];

const DRIVING_OPTIONS = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
];

const WEEK_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

interface IdentityStepProps {
  identity: FoundingIdentity;
  errors: FieldErrors<IdentityFieldId>;
  onChange: (field: IdentityFieldId, value: string) => void;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
}

export const fieldId = (field: IdentityFieldId) => `founding-${field}`;

function TextInput({
  field,
  value,
  error,
  onChange,
}: {
  field: TextField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = fieldId(field.id);
  return (
    <Field
      id={id}
      label={field.label}
      required={field.required}
      helper={field.helper}
      error={error}
    >
      <Input
        id={id}
        value={value}
        placeholder={field.placeholder}
        autoComplete="off"
        aria-required={field.required || undefined}
        onChange={(event) => onChange(event.target.value)}
        {...fieldAria(id, error, field.helper)}
      />
    </Field>
  );
}

/** The essentials of a nation's identity, with culture and civic standards behind "More details". */
export const IdentityStep = forwardRef<HTMLDivElement, IdentityStepProps>(function IdentityStep(
  { identity, errors, onChange, moreOpen, onMoreOpenChange },
  headingRef
) {
  const [nameField, ...restEssentials] = ESSENTIALS;
  return (
    <StepCard
      ref={headingRef}
      id="founding-identity"
      icon={<ProfileCircle />}
      title="Name your nation"
      description="Only the name is required. Everything here can change later in the editor."
    >
      <div className="flex flex-col gap-5">
        <TextInput
          field={nameField!}
          value={identity.name}
          error={errors.name}
          onChange={(value) => onChange("name", value)}
        />
        <FlagField
          id={fieldId("flagUrl")}
          value={identity.flagUrl}
          error={errors.flagUrl}
          onChange={(value) => onChange("flagUrl", value)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          {restEssentials.map((field) => (
            <TextInput
              key={field.id}
              field={field}
              value={identity[field.id]}
              error={errors[field.id]}
              onChange={(value) => onChange(field.id, value)}
            />
          ))}
        </div>
      </div>

      <Collapsible open={moreOpen} onOpenChange={onMoreOpenChange} className="flex flex-col gap-4">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="group self-start">
            More details
            <NavArrowDown
              aria-hidden
              className="ease-out-facet transition-transform duration-150 group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-5">
          <p className="text-callout text-label-secondary">
            Culture and civic standards. Fill in what you know; leave the rest blank.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {MORE_DETAILS.map((field) => (
              <TextInput
                key={field.id}
                field={field}
                value={identity[field.id]}
                error={errors[field.id]}
                onChange={(value) => onChange(field.id, value)}
              />
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span id="founding-drivingSide-label" className="text-subhead text-label">
                Driving side
              </span>
              <SegmentedControl
                id={fieldId("drivingSide")}
                aria-labelledby="founding-drivingSide-label"
                value={identity.drivingSide || undefined}
                onValueChange={(value) => onChange("drivingSide", value)}
                options={DRIVING_OPTIONS}
                size="sm"
                fullWidth
              />
              <p className="text-footnote text-label-secondary">Which side of the road cars use.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span id="founding-weekStartDay-label" className="text-subhead text-label">
                Week starts on
              </span>
              <SegmentedControl
                id={fieldId("weekStartDay")}
                aria-labelledby="founding-weekStartDay-label"
                value={identity.weekStartDay || undefined}
                onValueChange={(value) => onChange("weekStartDay", value)}
                options={WEEK_OPTIONS}
                size="sm"
                fullWidth
              />
              <p className="text-footnote text-label-secondary">The first day on calendars.</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </StepCard>
  );
});
