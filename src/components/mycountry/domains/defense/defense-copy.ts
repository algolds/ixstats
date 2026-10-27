/**
 * The Defense page's words: plain-language names for the model's quantities, with the analysts' terms kept as
 * secondary detail. One place so the overview, the levers, the rail and the branch cards say the same thing.
 */
import type {
  AlertLevel,
  BudgetWarning,
  CLevel,
  DefenseBudgetSource,
  Doctrine,
  OmPriority,
  SharePreset,
} from "~/lib/military/model";
import type { ManpowerModel, ShareKey, SubScoreKey } from "~/lib/military/defense-console";

export const C_LEVEL_COPY: Record<CLevel, { label: string; detail: string }> = {
  "C-1": { label: "Fully ready", detail: "90% or more. Ready for its full range of missions." },
  "C-2": { label: "Mostly ready", detail: "80 to 89%. Ready for most of its missions." },
  "C-3": { label: "Partly ready", detail: "70 to 79%. Can take on some missions, with risk." },
  "C-4": { label: "Not ready", detail: "Under 70%. Needs money and time before it can fight well." },
};

export const SUB_SCORE_COPY: Record<
  SubScoreKey,
  { label: string; analyst: string; meaning: string; fix: string }
> = {
  personnel: {
    label: "Personnel fill",
    analyst: "P-level",
    meaning: "Posts filled against what the branch's equipment and funded strength need.",
    fix: "Raise the personnel share, or let recruiting catch up with a target strength.",
  },
  equipment: {
    label: "Equipment on hand",
    analyst: "S-level",
    meaning: "Equipment held against what its personnel are organised around.",
    fix: "Raise the procurement share or order equipment for the branch.",
  },
  condition: {
    label: "Equipment condition",
    analyst: "R-level",
    meaning: "How much of the equipment works. Unfunded maintenance builds a backlog that takes years to clear.",
    fix: "Raise the operations and maintenance share, or favour maintenance in upkeep priority.",
  },
  training: {
    label: "Training",
    analyst: "T-level",
    meaning: "How well the force is trained. It rises over months when funded and fades over about nine months when not.",
    fix: "Raise the operations and maintenance share, or favour training in upkeep priority.",
  },
};

export const SHARE_COPY: Record<ShareKey, { label: string; buys: string }> = {
  personnel: { label: "Personnel", buys: "Pay for active personnel and reserve refresher training" },
  om: { label: "Operations and maintenance", buys: "Training, equipment upkeep and supply" },
  procurement: { label: "Procurement", buys: "Equipment orders and new capital" },
  rd: { label: "Research and development", buys: "Keeps your industry near the technology frontier" },
  infrastructure: { label: "Infrastructure", buys: "Bases and fortifications" },
};

export const PRESET_COPY: Record<SharePreset, { label: string; detail: string }> = {
  professional: {
    label: "Professional",
    detail: "A smaller, well-trained and well-kept volunteer force.",
  },
  territorial: {
    label: "Territorial conscript",
    detail: "A large force of conscripts and reserves for home defense.",
  },
  rearm: {
    label: "Rearm",
    detail: "Half the budget goes on new equipment while the force holds its size.",
  },
};

export const MANPOWER_COPY: Record<ManpowerModel, { label: string; detail: string }> = {
  volunteer: {
    label: "All-volunteer",
    detail: "Costly per person and slow to recruit, but trains to the highest standard.",
  },
  mixed: {
    label: "Mixed",
    detail: "Volunteers and conscripts serve side by side.",
  },
  conscription: {
    label: "Conscription",
    detail: "Cheap and large, and fills the reserve fast, but trains to a lower ceiling.",
  },
};

export const DOCTRINE_COPY: Record<Doctrine, { label: string; detail: string }> = {
  defensive: {
    label: "Defensive",
    detail: "Home defense. Reservists report fastest.",
  },
  balanced: {
    label: "Balanced",
    detail: "Ready to defend at home and act abroad.",
  },
  expeditionary: {
    label: "Expeditionary",
    detail: "Built to operate abroad. Reservists report more slowly.",
  },
};

export const ALERT_COPY: Record<AlertLevel, { label: string; detail: string }> = {
  peacetime: { label: "Peacetime", detail: "Normal upkeep and wear." },
  elevated: {
    label: "Elevated",
    detail: "Upkeep +15%, wear +20%. Training can reach 95%. Takes 7 days to bite.",
  },
  high: {
    label: "High",
    detail: "Upkeep +40%, wear +50%. Other nations can see it. Takes 14 days to bite.",
  },
  war: {
    label: "War",
    detail: "Upkeep doubles, wear triples. Takes 30 days to bite.",
  },
};

export const OM_PRIORITY_COPY: Record<OmPriority, { label: string; detail: string }> = {
  balanced: { label: "Balanced", detail: "Upkeep money splits by need." },
  maintenance: { label: "Maintenance", detail: "Keeps equipment working first." },
  training: { label: "Training", detail: "Keeps the force trained first." },
};

export const WARNING_COPY: Record<BudgetWarning, { title: string; advice: string }> = {
  cannotRecapitalise: {
    title: "Procurement is under 20% of the defense budget",
    advice: "Equipment wears out faster than you replace it. Raise the procurement share, or apply the Rearm preset.",
  },
  readinessFalling: {
    title: "Upkeep is underfunded, so readiness is falling",
    advice: "Training or maintenance gets less than it needs. Raise the operations and maintenance share, or lower the alert level.",
  },
  payArrears: {
    title: "The force is bigger than its pay",
    advice: "Personnel will shrink to what pay supports and morale suffers. Raise the personnel share or the defense budget.",
  },
};

export const BUDGET_SOURCE_COPY: Record<DefenseBudgetSource, string> = {
  defenseDepartment: "From your Defense department's lines in the national budget",
  builder: "From the Defense spending set when your nation was founded",
  governmentForm: "Your government form's usual Defense share of spending, until you add a Defense department",
  estimate: "No Defense spending is recorded, so it assumes 2% of GDP",
  none: "No GDP or Defense spending is recorded, so there is no budget",
};
