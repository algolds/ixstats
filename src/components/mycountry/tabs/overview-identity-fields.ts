import {
  Landmark,
  MapPin,
  Globe2,
  DollarSign,
  Users,
  Globe,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Identity field config rendered as pills in the MyCountry overview tab.
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 */
export const OVERVIEW_IDENTITY_FIELDS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  getValue: (ni: any) => string | null;
}> = [
  {
    key: "governmentType",
    label: "Government",
    icon: Landmark,
    color: "text-amber-600 dark:text-amber-400",
    getValue: (ni) => ni.governmentType,
  },
  {
    key: "capitalCity",
    label: "Capital",
    icon: MapPin,
    color: "text-blue-600 dark:text-blue-400",
    getValue: (ni) => ni.capitalCity,
  },
  {
    key: "officialLanguages",
    label: "Languages",
    icon: Globe2,
    color: "text-purple-600 dark:text-purple-400",
    getValue: (ni) => ni.officialLanguages,
  },
  {
    key: "currency",
    label: "Currency",
    icon: DollarSign,
    color: "text-emerald-600 dark:text-emerald-400",
    getValue: (ni) =>
      ni.currency ? `${ni.currency}${ni.currencySymbol ? ` (${ni.currencySymbol})` : ""}` : null,
  },
  {
    key: "demonym",
    label: "Demonym",
    icon: Users,
    color: "text-rose-600 dark:text-rose-400",
    getValue: (ni) => ni.demonym,
  },
  {
    key: "callingCode",
    label: "Calling Code",
    icon: Globe,
    color: "text-indigo-600 dark:text-indigo-400",
    getValue: (ni) => ni.callingCode,
  },
  {
    key: "timeZone",
    label: "Time Zone",
    icon: Clock,
    color: "text-cyan-600 dark:text-cyan-400",
    getValue: (ni) => ni.timeZone,
  },
  {
    key: "internetTLD",
    label: "Internet TLD",
    icon: Globe,
    color: "text-orange-600 dark:text-orange-400",
    getValue: (ni) => ni.internetTLD,
  },
];
