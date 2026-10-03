/** Map layers an SVG can be uploaded into. */
export const LAYER_TYPES = [
  { value: "political", label: "Political" },
  { value: "climate", label: "Climate" },
  { value: "altitudes", label: "Altitudes" },
  { value: "rivers", label: "Rivers" },
  { value: "lakes", label: "Lakes" },
  { value: "icecaps", label: "Icecaps" },
  { value: "background", label: "Background" },
] as const;
