"use client";

import React, { useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Crown,
  ScaleFrameEnlarge as Scale,
  Group as Users,
  Suitcase as Briefcase,
  Link as Link2,
  LinkSlash as Link2Off,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { AdvancedFieldsDisclosure } from "~/app/builder/primitives/AdvancedFieldsDisclosure";
import type { GovernmentStructureInput } from "~/types/government";
import { governmentTypes } from "./governmentStructureConstants";

interface GovernmentStructureFieldsProps {
  data: GovernmentStructureInput;
  onChange: (field: keyof GovernmentStructureInput, value: string) => void;
  isReadOnly?: boolean;
  hideGovernmentType?: boolean;
}

const LABEL_CLASS = "text-label-secondary text-body font-medium";
const ICON_LABEL_CLASS = `${LABEL_CLASS} flex items-center`;

type IconType = React.ComponentType<{ className?: string }>;

/** A labelled text input; `icon` makes it a head/branch field with an icon in the label. */
function TextField({
  id,
  label,
  icon: Icon,
  value,
  placeholder,
  onChange,
  disabled,
  className,
  list,
}: {
  id: string;
  label: string;
  icon?: IconType;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  list?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={Icon ? ICON_LABEL_CLASS : LABEL_CLASS}>
        {Icon && <Icon className="mr-1 h-4 w-4" />}
        {label}
      </Label>
      <Input
        id={id}
        list={list}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
    </div>
  );
}

const BRANCH_FIELDS: {
  key: "legislatureName" | "executiveName" | "judicialName";
  label: string;
  icon: IconType;
  placeholder: string;
}[] = [
  {
    key: "legislatureName",
    label: "Legislature",
    icon: Users,
    placeholder: "e.g., Imperial Senate, Parliament",
  },
  {
    key: "executiveName",
    label: "Executive",
    icon: Briefcase,
    placeholder: "e.g., Imperial Cabinet, Executive Council",
  },
  {
    key: "judicialName",
    label: "Judiciary",
    icon: Scale,
    placeholder: "e.g., Supreme Court, High Court",
  },
];

export function GovernmentStructureFields({
  data,
  onChange,
  isReadOnly = false,
  hideGovernmentType = false,
}: GovernmentStructureFieldsProps) {
  const [isGovHeadLocked, setIsGovHeadLocked] = useState(
    () => data.headOfState === data.headOfGovernment && !!data.headOfState
  );

  const toggleGovHeadLock = () => {
    setIsGovHeadLocked(!isGovHeadLocked);
    if (!isGovHeadLocked) onChange("headOfGovernment", data.headOfState || "");
  };

  const handleHeadOfStateChange = (value: string) => {
    onChange("headOfState", value);
    if (isGovHeadLocked) onChange("headOfGovernment", value);
  };

  const nameField = (
    <TextField
      id="governmentName"
      label="Government name"
      value={data.governmentName}
      placeholder="e.g., Imperial Government of Caphiria"
      onChange={(v) => onChange("governmentName", v)}
      disabled={isReadOnly}
      className="w-full"
    />
  );

  return (
    <>
      {hideGovernmentType ? (
        nameField
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {nameField}
          <div>
            <TextField
              id="governmentType"
              label="Government type"
              list="governmentTypeSuggestions"
              value={data.governmentType}
              placeholder="e.g., Unitary Quaternalist Republic"
              onChange={(v) => onChange("governmentType", v)}
              disabled={isReadOnly}
              className="w-full"
            />
            <datalist id="governmentTypeSuggestions">
              {governmentTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="headOfState" className={ICON_LABEL_CLASS}>
              <Crown className="mr-1 h-4 w-4" />
              Head of state
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={toggleGovHeadLock}
              aria-pressed={isGovHeadLocked}
              className={cn(
                "gap-1 font-semibold",
                isGovHeadLocked ? "text-yellow" : "text-label-secondary"
              )}
              title={
                isGovHeadLocked
                  ? "Unlock Head of Government to set a different value"
                  : "Set Head of Government to match Head of State"
              }
            >
              {isGovHeadLocked ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
              <span>{isGovHeadLocked ? "Linked as Gov. Head" : "Link Gov. Head"}</span>
            </Button>
          </div>
          <Input
            id="headOfState"
            value={data.headOfState || ""}
            onChange={(e) => handleHeadOfStateChange(e.target.value)}
            placeholder="e.g., Emperor, President"
            disabled={isReadOnly}
          />
        </div>

        <TextField
          id="headOfGovernment"
          label="Head of government"
          icon={Briefcase}
          value={isGovHeadLocked ? data.headOfState || "" : data.headOfGovernment || ""}
          onChange={(v) => onChange("headOfGovernment", v)}
          placeholder={
            isGovHeadLocked ? "Same as Head of State" : "e.g., Prime Minister, Chancellor"
          }
          disabled={isReadOnly || isGovHeadLocked}
        />
      </div>

      {/* Institutional branches (advanced tier in FIELD_IMPORTANCE.government) */}
      <AdvancedFieldsDisclosure
        section="government"
        id="branches"
        values={{
          legislatureName: data.legislatureName,
          executiveName: data.executiveName,
          judicialName: data.judicialName,
        }}
        className="pt-1"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BRANCH_FIELDS.map((f) => (
            <TextField
              key={f.key}
              id={f.key}
              label={f.label}
              icon={f.icon}
              value={data[f.key] || ""}
              placeholder={f.placeholder}
              onChange={(v) => onChange(f.key, v)}
              disabled={isReadOnly}
            />
          ))}
        </div>
      </AdvancedFieldsDisclosure>
    </>
  );
}
