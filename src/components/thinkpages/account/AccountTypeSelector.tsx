"use client";

import { Crown, Journal as Newspaper, Group as Users } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export type AccountType = "government" | "media" | "citizen";

export interface AccountTypeOption {
  icon: typeof Crown;
  label: string;
  description: string;
  maxAccounts: number;
  color: "amber" | "blue" | "green";
  examples: string[];
}

export const ACCOUNT_TYPES: Record<AccountType, AccountTypeOption> = {
  government: {
    icon: Crown,
    label: "Government",
    description: "Official government accounts (Presidential, ministerial, diplomatic)",
    maxAccounts: 5,
    color: "amber",
    examples: ["Presidential Office", "Minister of Foreign Affairs", "Ambassador to UN"],
  },
  media: {
    icon: Newspaper,
    label: "Media",
    description: "News organizations, journalists, and bloggers",
    maxAccounts: 10,
    color: "blue",
    examples: ["National News Network", "Political Reporter", "Economic Analyst"],
  },
  citizen: {
    icon: Users,
    label: "Citizens",
    description: "Activists, influencers, and common people",
    maxAccounts: 17,
    color: "green",
    examples: ["Student Activist", "Business Owner", "Cultural Influencer"],
  },
};

export interface AccountTypeSelectorProps {
  selectedType: AccountType;
  onSelectType: (type: AccountType) => void;
  onContinue: () => void;
  className?: string;
}

export function AccountTypeSelector({
  selectedType,
  onSelectType,
  onContinue,
  className,
}: AccountTypeSelectorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <h3 className="text-headline text-label">Select Account Type</h3>
        <p className="text-footnote text-label-secondary">
          Choose the role for your new Thinkpages identity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((typeKey) => {
          const type = ACCOUNT_TYPES[typeKey];
          const Icon = type.icon;
          const isSelected = selectedType === typeKey;

          return (
            <button
              key={typeKey}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectType(typeKey)}
              className={cn(
                "rounded-row flex items-start gap-3 border p-4 text-left transition-[background-color,border-color,scale] duration-150 active:scale-[0.98]",
                isSelected
                  ? "border-tint bg-tint-fill"
                  : "border-separator bg-surface-secondary hover:bg-fill-3"
              )}
            >
              <div
                className={cn(
                  "rounded-row flex size-10 shrink-0 items-center justify-center",
                  type.color === "amber" && "bg-yellow/15 text-yellow",
                  type.color === "blue" && "bg-blue/15 text-blue",
                  type.color === "green" && "bg-green/15 text-green"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-headline text-label">{type.label}</span>
                  <span className="text-footnote text-label-secondary tabular-nums">
                    Max {type.maxAccounts} accounts
                  </span>
                </div>
                <p className="text-callout text-label-secondary">{type.description}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {type.examples.map((ex, i) => (
                    <Badge key={i} variant="default">
                      {ex}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onContinue}>Next: Account Details →</Button>
      </div>
    </div>
  );
}
