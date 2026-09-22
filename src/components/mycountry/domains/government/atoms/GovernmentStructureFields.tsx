"use client";

import React, { useCallback, useState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Crown,
  ScaleFrameEnlarge as Scale,
  Group as Users,
  Suitcase as Briefcase,
  Link as Link2,
  LinkSlash as Link2Off,
  Settings,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import type { GovernmentStructureInput } from "~/types/government";
import { governmentTypes } from "./governmentStructureConstants";

interface GovernmentStructureFieldsProps {
  data: GovernmentStructureInput;
  onChange: (field: keyof GovernmentStructureInput, value: string) => void;
  isReadOnly?: boolean;
  hideGovernmentType?: boolean;
}

export function GovernmentStructureFields({
  data,
  onChange,
  isReadOnly = false,
  hideGovernmentType = false,
}: GovernmentStructureFieldsProps) {
  const [isGovHeadLocked, setIsGovHeadLocked] = useState(() => {
    return data.headOfState === data.headOfGovernment && !!data.headOfState;
  });

  const [showAdvancedBranches, setShowAdvancedBranches] = useState(() => {
    return Boolean(data.legislatureName || data.executiveName || data.judicialName);
  });

  const toggleGovHeadLock = useCallback(() => {
    const next = !isGovHeadLocked;
    setIsGovHeadLocked(next);
    if (next) {
      onChange("headOfGovernment", data.headOfState || "");
    }
  }, [isGovHeadLocked, data.headOfState, onChange]);

  const handleHeadOfStateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onChange("headOfState", value);
      if (isGovHeadLocked) {
        onChange("headOfGovernment", value);
      }
    },
    [isGovHeadLocked, onChange]
  );

  return (
    <>
      {/* Basic Information */}
      {hideGovernmentType ? (
        <div className="space-y-2">
          <Label
            htmlFor="governmentName"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Government Name
          </Label>
          <Input
            id="governmentName"
            value={data.governmentName}
            onChange={(e) => onChange("governmentName", e.target.value)}
            placeholder="e.g., Imperial Government of Caphiria"
            disabled={isReadOnly}
            className="w-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="governmentName"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Government Name
            </Label>
            <Input
              id="governmentName"
              value={data.governmentName}
              onChange={(e) => onChange("governmentName", e.target.value)}
              placeholder="e.g., Imperial Government of Caphiria"
              disabled={isReadOnly}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="governmentType"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Government Type
            </Label>
            <Input
              id="governmentType"
              list="governmentTypeSuggestions"
              value={data.governmentType}
              onChange={(e) => onChange("governmentType", e.target.value)}
              placeholder="e.g., Unitary Quaternalist Republic"
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

      {/* Leadership */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="headOfState"
              className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
            >
              <Crown className="mr-1 h-4 w-4" />
              Head of State
            </Label>
            <button
              type="button"
              onClick={toggleGovHeadLock}
              className={cn(
                "flex items-center gap-1 text-[10px] font-semibold transition-all duration-150 focus:outline-none",
                isGovHeadLocked
                  ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={
                isGovHeadLocked
                  ? "Unlock Head of Government to set a different value"
                  : "Set Head of Government to match Head of State"
              }
            >
              {isGovHeadLocked ? (
                <>
                  <Link2 className="h-3 w-3" />
                  <span>Linked as Gov. Head</span>
                </>
              ) : (
                <>
                  <Link2Off className="text-muted-foreground/60 h-3 w-3" />
                  <span>Link Gov. Head</span>
                </>
              )}
            </button>
          </div>
          <Input
            id="headOfState"
            value={data.headOfState || ""}
            onChange={handleHeadOfStateChange}
            placeholder="e.g., Emperor, President"
            disabled={isReadOnly}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="headOfGovernment"
            className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
          >
            <Briefcase className="mr-1 h-4 w-4" />
            Head of Government
          </Label>
          <Input
            id="headOfGovernment"
            value={isGovHeadLocked ? data.headOfState || "" : data.headOfGovernment || ""}
            onChange={(e) => onChange("headOfGovernment", e.target.value)}
            placeholder={
              isGovHeadLocked ? "Same as Head of State" : "e.g., Prime Minister, Chancellor"
            }
            disabled={isReadOnly || isGovHeadLocked}
          />
        </div>
      </div>

      {/* Advanced Branches of Government (Progressive Disclosure) */}
      <Collapsible open={showAdvancedBranches} onOpenChange={setShowAdvancedBranches} className="pt-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{showAdvancedBranches ? "Hide institutional branches" : "Show institutional branches"}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                showAdvancedBranches && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label
                htmlFor="legislatureName"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Users className="mr-1 h-4 w-4" />
                Legislature
              </Label>
              <Input
                id="legislatureName"
                value={data.legislatureName || ""}
                onChange={(e) => onChange("legislatureName", e.target.value)}
                placeholder="e.g., Imperial Senate, Parliament"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="executiveName"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Briefcase className="mr-1 h-4 w-4" />
                Executive
              </Label>
              <Input
                id="executiveName"
                value={data.executiveName || ""}
                onChange={(e) => onChange("executiveName", e.target.value)}
                placeholder="e.g., Imperial Cabinet, Executive Council"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="judicialName"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Scale className="mr-1 h-4 w-4" />
                Judiciary
              </Label>
              <Input
                id="judicialName"
                value={data.judicialName || ""}
                onChange={(e) => onChange("judicialName", e.target.value)}
                placeholder="e.g., Supreme Court, High Court"
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
