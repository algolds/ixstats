import nations from "./nations";

// Excerpt of a-seth-harrison/eurth-map src/data/organizations.js (two organisations, members trimmed to the
// fixture's nations; Haitu is listed but is not in nations.js), for the realm source sync tests.
export const ORGANIZATIONS = [
  {
    id: "aurelian-league",
    name: "Aurelian League (AL)",
    color: "#f6aa27",
    // Cruciastada was a member until 2026-10-03, when it was expelled
    members: ["Mito", "Kiziauke"],
  },
  {
    id: "west-argic-security-pact",
    name: "West Argic Security Pact (WASP)",
    color: "#8E44AD", // placeholder colour
    members: ["Tavok", "Bainbridge-Islands", "Haitu"],
  },
];

if (import.meta.env.DEV) {
  for (const org of ORGANIZATIONS) {
    for (const key of org.members) {
      if (!nations[key]) console.warn(`${org.name}: member "${key}" is not in nations.js`);
    }
  }
}

export function memberColors(enabled) {
  const out = {};
  for (const org of ORGANIZATIONS) if (enabled.has(org.id)) for (const k of org.members) (out[k] ??= []).push(org.color);
  return out;
}
