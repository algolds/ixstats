/** Charges drawn from the renderer's built-in path library (no imported SVG needed). */
export const BUILTIN_CHARGES = [
  { id: "star", name: "Star (mullet)" },
  { id: "cross", name: "Cross" },
  { id: "fleur-de-lis", name: "Fleur-de-lis" },
  { id: "lion", name: "Lion rampant" },
  { id: "eagle", name: "Eagle displayed" },
];

export const isBuiltinCharge = (chargeId: string) => BUILTIN_CHARGES.some((c) => c.id === chargeId);

/** A charge's display name; imported charges are stored by id, so they read as "Imported charge". */
export const chargeName = (chargeId: string) =>
  BUILTIN_CHARGES.find((c) => c.id === chargeId)?.name ?? "Imported charge";
