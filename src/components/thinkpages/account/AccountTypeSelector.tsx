"use client";

import { Crown, Journal as Newspaper, Group as Users } from "iconoir-react";
import { cn } from "~/lib/utils";

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
        <h3 className="text-base font-bold tracking-tight text-white">Select Account Type</h3>
        <p className="text-xs text-slate-400">Choose the role for your new Thinkpages identity.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((typeKey) => {
          const type = ACCOUNT_TYPES[typeKey];
          const Icon = type.icon;
          const isSelected = selectedType === typeKey;

          return (
            <button
              key={typeKey}
              onClick={() => onSelectType(typeKey)}
              className={cn(
                "flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98]",
                isSelected
                  ? "border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                  type.color === "amber" && "border-amber-500/30 bg-amber-500/15 text-amber-400",
                  type.color === "blue" && "border-blue-500/30 bg-blue-500/15 text-blue-400",
                  type.color === "green" &&
                    "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold tracking-tight text-white">{type.label}</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Max {type.maxAccounts} accounts
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{type.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {type.examples.map((ex, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-medium text-slate-300"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onContinue}
          className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition-all duration-150 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.96]"
        >
          Next: Account Details →
        </button>
      </div>
    </div>
  );
}
