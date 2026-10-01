import {
  Bank as Landmark,
  MapPin,
  Globe as Globe2,
  Dollar as DollarSign,
  Group as Users,
  Globe,
  Clock,
} from "iconoir-react";

import { toTitleCase } from "~/lib/utils";
import type { NationalIdentityData } from "~/app/builder/lib/economy-types";

/**
 * Identity field config rendered as pills in the MyCountry overview tab.
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 */
export const OVERVIEW_IDENTITY_FIELDS: Array<{
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  getValue: (ni: Partial<NationalIdentityData>) => string | null | undefined;
}> = [
  {
    key: "governmentType",
    label: "Government",
    icon: Landmark,
    color: "text-label-secondary",
    getValue: (ni) => (ni.governmentType ? toTitleCase(ni.governmentType) : null),
  },
  {
    key: "capitalCity",
    label: "Capital",
    icon: MapPin,
    color: "text-label-secondary",
    getValue: (ni) => ni.capitalCity,
  },
  {
    key: "officialLanguages",
    label: "Languages",
    icon: Globe2,
    color: "text-label-secondary",
    getValue: (ni) => ni.officialLanguages,
  },
  {
    key: "currency",
    label: "Currency",
    icon: DollarSign,
    color: "text-label-secondary",
    getValue: (ni) =>
      ni.currency ? `${ni.currency}${ni.currencySymbol ? ` (${ni.currencySymbol})` : ""}` : null,
  },
  {
    key: "demonym",
    label: "Demonym",
    icon: Users,
    color: "text-label-secondary",
    getValue: (ni) => ni.demonym,
  },
  {
    key: "callingCode",
    label: "Calling Code",
    icon: Globe,
    color: "text-label-secondary",
    getValue: (ni) => ni.callingCode,
  },
  {
    key: "timeZone",
    label: "Time Zone",
    icon: Clock,
    color: "text-label-secondary",
    getValue: (ni) => ni.timeZone,
  },
  {
    key: "internetTLD",
    label: "Internet TLD",
    icon: Globe,
    color: "text-label-secondary",
    getValue: (ni) => ni.internetTLD,
  },
];
