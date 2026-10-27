// Excerpt of a-seth-harrison/eurth-map src/data/nations.js (five entries), for the realm source sync tests.
const nations = {
  Tavok: {
    name: "Republic of Tavok",
    color: "#0a3d2a",
    population: 48000000,
    gdppc: 39500,
    landArea: 248153,
    capital: "Tyyrik",
    iiwikiLink: "https://iiwiki.com/w/Tavok",
  },
  Kiziauke: {
    name: "Kīzināpe Sintezan Socialist Republics",
    color: "#b71137",
    population: 48132950,
    gdppc: 39916,
    landArea: 222000,
    capital: "Pachetan",
    iiwikiLink: "https://iiwiki.com/w/Kíziáuke",
  },
  // --- Database-only entries below: no full name or capital yet. ---
  // Missing values are null (shown as "—" in the panel).

  // Aurelia
  Mito: {
    name: "Mito",
    color: "#890101",
    npc: true,
    population: 13723000,
    gdppc: 44829,
    landArea: 59355,
    capital: "Kenkyō",
    iiwikiLink: "https://iiwiki.com/w/Mito",
    secondaryFields: ["capital", "gdppc", "landArea"],
  },
  "Bainbridge-Islands": {
    name: "Bainbridge Islands",
    color: "#06166c",
    population: 18900000,
    gdppc: 48033,
    landArea: 309613,
    capital: "Honolulu",
    iiwikiLink: "https://iiwiki.com/w/Bainbridge_Islands",
    secondaryFields: ["capital", "population", "gdppc", "landArea"],
  },
  Deseti: {
    name: "Deseti",
    color: "#e62d39",
    population: null,
    gdppc: null,
    landArea: null,
    capital: null,
    iiwikiLink: "https://iiwiki.com/w/Deseti",
  },
};

export default nations;
