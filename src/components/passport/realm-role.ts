import type { RealmItem } from "./types";

/** How a realm role reads on the passport; a plain member is not labelled. */
export const REALM_ROLE_LABEL: Record<RealmItem["role"], string | null> = {
  founder: "Founder",
  officer: "Officer",
  member: null,
};
