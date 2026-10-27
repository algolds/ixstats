/** Charges drawn from the renderer's built-in path library (no imported SVG needed). */
export const BUILTIN_CHARGES = [
  { id: "star", name: "Star (Mullet)" },
  { id: "cross", name: "Cross" },
  { id: "fleur-de-lis", name: "Fleur-de-lis" },
  { id: "lion", name: "Lion Rampant" },
  { id: "eagle", name: "Eagle Displayed" },
];

export const isBuiltinCharge = (chargeId: string) => BUILTIN_CHARGES.some((c) => c.id === chargeId);
