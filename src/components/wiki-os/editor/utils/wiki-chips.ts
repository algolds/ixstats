// src/components/wiki-os/editor/utils/wiki-chips.ts
// Helper utilities for rendering and parsing custom WikiOS / MyCountry chips and templates.

export function getChipClassName(name: string): string {
  let type = "mycountry";
  if (name.startsWith("CountryData:")) {
    type = "countrydata";
  } else if (name.startsWith("BusinessData:")) {
    type = "businessdata";
  }
  return `wikios-ve-custom-chip chip-${type} wikios-ve-template`;
}

export function getChipInnerHTML(name: string): string {
  let icon = "📊";
  if (name.startsWith("CountryData:")) {
    icon = "📈";
  } else if (name.startsWith("BusinessData:")) {
    icon = "💼";
  }
  return `<span class="opacity-70">${icon}</span> ${name}`;
}

export function parseWikitextTemplate(wikitext: string) {
  const clean = wikitext.trim().replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts = clean.split("|");
  const templateName = parts[0]?.trim() || "";
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      params[key] = val;
    }
  }
  return { templateName, params };
}

export function parseCoordsOrMapEmbed(wikitext: string) {
  const clean = wikitext.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
  const parts = clean.split("|");
  const head = parts[0] || "";
  const optionOrLabel = parts[1] || "";
  const colonIdx = head.indexOf(":");
  const type = colonIdx !== -1 ? head.slice(0, colonIdx) : head;
  const values = colonIdx !== -1 ? head.slice(colonIdx + 1) : "";
  return { type, values, optionOrLabel };
}
