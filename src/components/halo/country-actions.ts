import type * as React from "react";
import {
  City as Building2,
  Coins,
  Community as Handshake,
  EditPencil as Edit3,
  Hammer as Gavel,
  Map as MapIcon,
  ChatBubble as MessageSquare,
  ScaleFrameEnlarge as Scale,
  Shield,
  User,
  Wallet,
} from "iconoir-react";
import {
  MYCOUNTRY_ECONOMY_PATH,
  MYCOUNTRY_EDITOR_PATH,
  MYCOUNTRY_MAP_EDITOR_PATH,
  MYCOUNTRY_PATH,
} from "~/lib/mycountry/routes";
import { generateSlug } from "~/lib/utils/slug-utils";

export type CountryActionId =
  | "profile"
  | "overview"
  | "executive"
  | "diplomacy"
  | "defense"
  | "economy"
  | "politics"
  | "map-editor"
  | "editor"
  | "vault"
  | "messages";

export interface CountryAction {
  id: CountryActionId;
  label: string;
  path: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconClass: string;
  dataApp?: string;
  isPremium?: boolean;
}

export function countryProfilePath(country: { name: string; slug?: string | null }): string {
  return `/countries/${country.slug || generateSlug(country.name)}`;
}

export const COUNTRY_ACTIONS: readonly CountryAction[] = [
  {
    id: "profile",
    label: "Profile",
    path: "/countries",
    icon: User,
    iconClass: "text-blue",
  },
  {
    id: "overview",
    label: "MyCountry",
    path: MYCOUNTRY_PATH,
    icon: Building2,
    iconClass: "text-yellow",
  },
  {
    id: "executive",
    label: "Executive",
    path: "/mycountry/executive",
    icon: Gavel,
    iconClass: "text-indigo",
  },
  {
    id: "diplomacy",
    label: "Diplomacy",
    path: "/mycountry/diplomacy",
    icon: Handshake,
    iconClass: "text-teal",
  },
  {
    id: "defense",
    label: "Defense",
    path: "/mycountry/defense",
    icon: Shield,
    iconClass: "text-red",
    isPremium: true,
  },
  {
    id: "economy",
    label: "Economy",
    path: MYCOUNTRY_ECONOMY_PATH,
    icon: Coins,
    iconClass: "text-yellow",
  },
  {
    id: "politics",
    label: "Politics",
    path: "/mycountry/politics",
    icon: Scale,
    iconClass: "text-indigo",
  },
  {
    id: "map-editor",
    label: "Map editor",
    path: MYCOUNTRY_MAP_EDITOR_PATH,
    icon: MapIcon,
    iconClass: "text-teal",
  },
  {
    id: "editor",
    label: "Country editor",
    path: MYCOUNTRY_EDITOR_PATH,
    icon: Edit3,
    iconClass: "text-yellow",
  },
  {
    id: "vault",
    label: "My cards",
    path: "/vault",
    icon: Wallet,
    iconClass: "text-tint",
    dataApp: "vault",
  },
  {
    id: "messages",
    label: "Messages",
    path: "/messages",
    icon: MessageSquare,
    iconClass: "text-blue",
  },
];

const ACTIONS_BY_ID = new Map<CountryActionId, CountryAction>(
  COUNTRY_ACTIONS.map((action) => [action.id, action])
);

export function getCountryAction(id: CountryActionId): CountryAction {
  const found = ACTIONS_BY_ID.get(id);
  if (!found) {
    throw new Error(`Unknown country action: ${id}`);
  }
  return found;
}

export function getCountryActions(ids: readonly CountryActionId[]): CountryAction[] {
  return ids.map(getCountryAction);
}
