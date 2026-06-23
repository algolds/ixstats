import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Re-create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PDSConfig {
  id: string;
  name: string;
  season: number | null;
  rarityTier: string;
  theme: string;
  emblem: string;
  material: string;
  foil: string;
  glow: string;
  specialEffects: string[];
}

interface PackData {
  id: string;
  name: string;
  packType: string;
  season: number | null;
  pdsConfig: PDSConfig;
}

// ─── Colors and Gradients Configurations ─────────────────────────

const THEME_BG_COLORS: Record<string, { start: string; mid: string; end: string }> = {
  REGIONAL: { start: "#0f172a", mid: "#1e293b", end: "#020617" }, // Slate
  ECONOMIC: { start: "#064e3b", mid: "#065f46", end: "#022c22" }, // Emerald
  DIPLOMATIC: { start: "#0c4a6e", mid: "#075985", end: "#0369a1" }, // Sky/Blue
  IMPERIAL: { start: "#3b0764", mid: "#581c87", end: "#1e1b4b" }, // Purple/Royal
  LORE: { start: "#18000a", mid: "#310015", end: "#0f0003" }, // Cosmic Dark Magenta
  EVENT: { start: "#450a0a", mid: "#7f1d1d", end: "#180000" }, // Red/Crimson
};

const SEASON_COLORS: Record<number, string> = {
  1: "#b45309", // Season I: Bronze
  2: "#94a3b8", // Season II: Silver
  3: "#fbbf24", // Season III: Gold
  4: "#c084fc", // Season IV: Imperial Purple
  5: "#1e293b", // Season V: Obsidian Black
  6: "#34d399", // Season VI: Emerald
};

// ─── SVG Primitive Drawing Helpers ───────────────────────────────

function drawCrimpPattern() {
  // Top/bottom seam packaging crimps
  let paths = "";
  for (let i = 0; i <= 340; i += 8) {
    paths += `M ${i},0 L ${i},18 M ${i + 4},0 L ${i + 4},18 `;
    paths += `M ${i},492 L ${i},510 M ${i + 4},492 L ${i + 4},510 `;
  }
  return `<path d="${paths}" stroke="rgba(0, 0, 0, 0.4)" stroke-width="2.5" stroke-linecap="round" />`;
}

function drawTearNotch() {
  return `
    <!-- Tear Notch -->
    <path d="M 0,60 L 12,65 L 0,70 Z" fill="rgba(0,0,0,0.5)" />
    <path d="M 340,60 L 328,65 L 340,70 Z" fill="rgba(0,0,0,0.5)" />
  `;
}

function drawLogoBranding(packType: string, season: number | null) {
  const seasonText = season ? `S${season}` : "CORE";
  return `
    <!-- branding monogram -->
    <g transform="translate(170, 42)" opacity="0.75" text-anchor="middle">
      <path d="M -12,-8 L -4,-8 L 0,2 L 4,-8 L 12,-8 L 3,12 L -3,12 Z" fill="#ffffff" />
      <path d="M -18,-8 L -14,-8 L -14,12 L -18,12 Z" fill="#ffffff" />
      <rect x="18" y="-8" width="4" height="20" fill="#ffffff" />
    </g>
    <!-- branding text -->
    <text x="170" y="475" fill="#ffffff" opacity="0.35" font-family="'Inter', sans-serif" font-size="9" font-weight="900" letter-spacing="4" text-anchor="middle">
      IXCARDS • ${seasonText} • ${packType}
    </text>
  `;
}

function drawEmblem(emblemType: string, color: string): string {
  const stroke = color;
  switch (emblemType) {
    case "SHIELD":
      return `
        <!-- Shield Emblem -->
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <path d="M 170,195 L 215,208 C 215,255 195,290 170,305 C 145,290 125,255 125,208 Z" />
          <path d="M 170,205 L 202,215 C 202,250 186,278 170,291 C 154,278 138,250 138,215 Z" opacity="0.5" stroke-width="1.5" />
          <line x1="170" y1="205" x2="170" y2="290" stroke-width="1.5" opacity="0.6" />
        </g>
      `;
    case "CROWN":
      return `
        <!-- Crown Emblem -->
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <path d="M 120,285 L 120,230 L 145,250 L 170,215 L 195,250 L 220,230 L 220,285 Z" />
          <rect x="120" y="285" width="100" height="6" fill="${stroke}" opacity="0.3" />
          <circle cx="120" cy="230" r="3.5" fill="${stroke}" />
          <circle cx="170" cy="215" r="3.5" fill="${stroke}" />
          <circle cx="220" cy="230" r="3.5" fill="${stroke}" />
        </g>
      `;
    case "DIAMOND":
      return `
        <!-- Diamond Emblem -->
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <path d="M 140,215 L 200,215 L 230,245 L 170,305 L 110,245 Z" />
          <line x1="140" y1="215" x2="170" y2="305" stroke-width="1.5" opacity="0.6" />
          <line x1="200" y1="215" x2="170" y2="305" stroke-width="1.5" opacity="0.6" />
          <line x1="110" y1="245" x2="230" y2="245" stroke-width="1.5" opacity="0.6" />
        </g>
      `;
    case "EYE":
      return `
        <!-- Eye Emblem -->
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <path d="M 110,250 Q 170,200 230,250 Q 170,300 110,250 Z" />
          <circle cx="170" cy="250" r="22" />
          <circle cx="170" cy="250" r="8" fill="${stroke}" />
        </g>
      `;
    case "STAR":
      return `
        <!-- Star Emblem -->
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <path d="M 170,185 L 182,230 L 225,230 L 190,255 L 202,300 L 170,272 L 138,300 L 150,255 L 115,230 L 158,230 Z" />
        </g>
      `;
    case "TROPHY":
      return `
        <!-- Trophy Emblem -->
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <path d="M 125,205 L 215,205 L 215,245 C 215,275 190,295 170,295 C 150,295 125,275 125,245 Z" />
          <path d="M 170,295 L 170,320 M 145,320 L 195,320" stroke-width="3" />
          <path d="M 125,218 C 105,218 105,248 125,248 M 215,218 C 235,218 235,248 215,248" stroke-width="1.8" />
        </g>
      `;
    default:
      return "";
  }
}

function drawSeasonCrest(season: number | null, color: string) {
  if (!season) return "";
  const romanMap: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
  const roman = romanMap[season] ?? season.toString();
  return `
    <!-- Season Roman Crest -->
    <g transform="translate(170, 115)">
      <polygon points="0,-22 18,-8 18,18 0,30 -18,18 -18,-8" fill="rgba(0,0,0,0.6)" stroke="${color}" stroke-width="2" />
      <text y="7" fill="${color}" font-family="'Times New Roman', serif" font-size="16" font-weight="bold" text-anchor="middle">${roman}</text>
    </g>
  `;
}

function drawThemeAccents(theme: string, accentColor: string) {
  switch (theme) {
    case "LORE":
      return `
        <!-- Arcane circular geometry -->
        <circle cx="170" cy="250" r="105" stroke="${accentColor}" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.25" />
        <circle cx="170" cy="250" r="90" stroke="${accentColor}" stroke-width="1" fill="none" opacity="0.15" />
        <path d="M 90,250 L 250,250 M 170,170 L 170,330" stroke="${accentColor}" stroke-width="0.75" opacity="0.2" />
      `;
    case "ECONOMIC":
      return `
        <!-- Intersecting coin grids -->
        <g stroke="${accentColor}" stroke-width="1" fill="none" opacity="0.2">
          <circle cx="90" cy="250" r="45" />
          <circle cx="250" cy="250" r="45" />
          <rect x="55" y="145" width="230" height="210" rx="15" />
        </g>
      `;
    case "DIPLOMATIC":
      return `
        <!-- Compass rose lines -->
        <g stroke="${accentColor}" stroke-width="1" fill="none" opacity="0.25">
          <line x1="60" y1="140" x2="280" y2="360" />
          <line x1="280" y1="140" x2="60" y2="360" />
          <circle cx="170" cy="250" r="70" stroke-dasharray="4 4" />
        </g>
      `;
    case "IMPERIAL":
      return `
        <!-- Ornate gold filigree lines -->
        <path d="M 40,75 L 300,75 M 40,435 L 300,435" stroke="${accentColor}" stroke-width="2" opacity="0.3" />
        <path d="M 45,70 L 45,440 M 295,70 L 295,440" stroke="${accentColor}" stroke-width="1" opacity="0.2" />
        <rect x="50" y="80" width="240" height="350" fill="none" stroke="${accentColor}" stroke-width="0.5" opacity="0.15" />
      `;
    case "REGIONAL":
      return `
        <!-- Map mesh overlay -->
        <g stroke="${accentColor}" stroke-width="0.75" fill="none" opacity="0.15">
          <path d="M 40,150 Q 120,180 200,120 T 300,200" />
          <path d="M 40,320 Q 150,290 220,350 T 300,290" />
          <line x1="80" y1="80" x2="80" y2="430" />
          <line x1="260" y1="80" x2="260" y2="430" />
        </g>
      `;
    case "EVENT":
      return `
        <!-- Dynamic radial burst lines -->
        <g stroke="${accentColor}" stroke-width="1" opacity="0.2">
          <line x1="170" y1="250" x2="30" y2="110" />
          <line x1="170" y1="250" x2="310" y2="110" />
          <line x1="170" y1="250" x2="30" y2="390" />
          <line x1="170" y1="250" x2="310" y2="390" />
          <circle cx="170" cy="250" r="125" stroke-width="1.5" stroke-dasharray="2 8" />
        </g>
      `;
    default:
      return "";
  }
}

// ─── Main SVG File Generators ────────────────────────────────────

function generateBaseSvg(pack: PackData): string {
  const pds = pack.pdsConfig;
  const bg = THEME_BG_COLORS[pds.theme] ?? THEME_BG_COLORS.REGIONAL;
  const accentColor = pds.season ? SEASON_COLORS[pds.season] : "#a855f7";

  return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 510" width="100%" height="100%">
  <defs>
    <!-- Base Material Gradients -->
    <linearGradient id="matte-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg.start}" />
      <stop offset="50%" stop-color="${bg.mid}" />
      <stop offset="100%" stop-color="${bg.end}" />
    </linearGradient>
    <linearGradient id="chrome-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="25%" stop-color="#cbd5e1" />
      <stop offset="50%" stop-color="#f8fafc" />
      <stop offset="75%" stop-color="#94a3b8" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>
    <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="25%" stop-color="#ca8a04" />
      <stop offset="50%" stop-color="#fef9c3" />
      <stop offset="75%" stop-color="#a16207" />
      <stop offset="100%" stop-color="#854d0e" />
    </linearGradient>
    <linearGradient id="prismatic-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff00a0" />
      <stop offset="20%" stop-color="#a000ff" />
      <stop offset="40%" stop-color="#00a0ff" />
      <stop offset="60%" stop-color="#00ffa0" />
      <stop offset="80%" stop-color="#ffa000" />
      <stop offset="100%" stop-color="#ff00a0" />
    </linearGradient>
  </defs>

  <!-- Base foil wrapping background -->
  <rect x="0" y="0" width="340" height="510" fill="url(#matte-grad)" />

  <!-- Material layer overlay -->
  ${
    pds.material === "CHROME"
      ? `<rect x="0" y="0" width="340" height="510" fill="url(#chrome-grad)" opacity="0.35" style="mix-blend-mode: overlay;" />`
      : pds.material === "GOLD"
        ? `<rect x="0" y="0" width="340" height="510" fill="url(#gold-grad)" opacity="0.55" style="mix-blend-mode: overlay;" />`
        : pds.material === "PRISMATIC"
          ? `<rect x="0" y="0" width="340" height="510" fill="url(#prismatic-grad)" opacity="0.3" style="mix-blend-mode: color-dodge;" />`
          : ""
  }

  <!-- Foil Fold Textures -->
  <path d="M 0,0 L 40,510 M 340,0 L 300,510" stroke="rgba(255, 255, 255, 0.05)" stroke-width="8" />
  <path d="M 120,0 L 220,510" stroke="rgba(0, 0, 0, 0.2)" stroke-width="12" opacity="0.3" />

  <!-- Theme Background Accents -->
  ${drawThemeAccents(pds.theme, accentColor)}

  <!-- Seasons Crest Layer -->
  ${drawSeasonCrest(pds.season, accentColor)}

  <!-- Central Emblem -->
  ${drawEmblem(pds.emblem, accentColor)}

  <!-- Embossed Outer Border Frame -->
  <rect x="18" y="18" width="304" height="474" rx="12" fill="none" stroke="${accentColor}" stroke-width="2.5" opacity="0.4" />
  <rect x="22" y="22" width="296" height="466" rx="8" fill="none" stroke="rgba(0, 0, 0, 0.4)" stroke-width="1" />

  <!-- Crimp Packaging Patterns (Top/Bottom) -->
  ${drawCrimpPattern()}

  <!-- Tear notch -->
  ${drawTearNotch()}

  <!-- Branding monograms and text -->
  ${drawLogoBranding(pack.packType, pds.season)}
</svg>`;
}

function generateFoilSvg(pack: PackData): string {
  const pds = pack.pdsConfig;
  if (pds.foil === "NONE") {
    // Return transparent dummy SVG
    return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 510" width="100%" height="100%" opacity="0">
  <rect width="100%" height="100%" fill="none" />
</svg>`;
  }

  let gradient = "";
  if (pds.foil === "SILVER") {
    gradient = `
      <linearGradient id="foil-overlay-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255, 255, 255, 0.45)" />
        <stop offset="35%" stop-color="rgba(200, 200, 200, 0.1)" />
        <stop offset="50%" stop-color="rgba(255, 255, 255, 0.7)" />
        <stop offset="65%" stop-color="rgba(200, 200, 200, 0.1)" />
        <stop offset="100%" stop-color="rgba(255, 255, 255, 0.45)" />
      </linearGradient>`;
  } else if (pds.foil === "GOLD") {
    gradient = `
      <linearGradient id="foil-overlay-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(254, 240, 138, 0.55)" />
        <stop offset="30%" stop-color="rgba(202, 138, 4, 0.1)" />
        <stop offset="50%" stop-color="rgba(254, 249, 195, 0.8)" />
        <stop offset="70%" stop-color="rgba(161, 98, 7, 0.1)" />
        <stop offset="100%" stop-color="rgba(254, 240, 138, 0.55)" />
      </linearGradient>`;
  } else if (pds.foil === "DIAMOND") {
    gradient = `
      <pattern id="foil-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 30,0 L 60,30 L 30,60 L 0,30 Z" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
        <path d="M 30,15 L 45,30 L 30,45 L 15,30 Z" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.75" />
      </pattern>`;
  } else {
    // RAINBOW / PRISMATIC
    gradient = `
      <linearGradient id="foil-overlay-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,0,128,0.45)" />
        <stop offset="20%" stop-color="rgba(128,0,255,0.3)" />
        <stop offset="40%" stop-color="rgba(0,128,255,0.3)" />
        <stop offset="60%" stop-color="rgba(0,255,128,0.3)" />
        <stop offset="80%" stop-color="rgba(255,255,0,0.3)" />
        <stop offset="100%" stop-color="rgba(255,0,128,0.45)" />
      </linearGradient>`;
  }

  const fillSource = pds.foil === "DIAMOND" ? "url(#foil-pattern)" : "url(#foil-overlay-grad)";

  return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 510" width="100%" height="100%">
  <defs>
    ${gradient}
  </defs>
  <!-- Foil layer texture reflection -->
  <rect width="340" height="510" fill="${fillSource}" />
</svg>`;
}

function generateGlowSvg(pack: PackData): string {
  const pds = pack.pdsConfig;
  if (pds.glow === "NONE") {
    // Return transparent dummy SVG
    return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 510" width="100%" height="100%" opacity="0">
  <rect width="100%" height="100%" fill="none" />
</svg>`;
  }

  const glowColor = pds.season ? SEASON_COLORS[pds.season] : "#a855f7";
  const opacity = pds.glow === "SUBTLE" ? "0.2" : pds.glow === "MEDIUM" ? "0.4" : "0.7";

  return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 510" width="100%" height="100%">
  <defs>
    <radialGradient id="auraglow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="${opacity}" />
      <stop offset="60%" stop-color="${glowColor}" stop-opacity="${(parseFloat(opacity) * 0.4).toFixed(2)}" />
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <!-- Glow overlay representing radiating energy aura -->
  <rect x="-50" y="-50" width="440" height="610" fill="url(#auraglow)" />
</svg>`;
}

// ─── Main Generation Script Runner ────────────────────────────────

export async function generatePackAssets() {
  console.log("🛠️  Starting PDS Asset Generator...");

  const dataDir = path.join(__dirname, "..", "..", "prisma", "seeds", "data");
  const jsonPath = path.join(dataDir, "card-packs.json");
  const outputDir = path.resolve(__dirname, "..", "..", "public", "images", "packs");

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Missing pack definitions JSON: ${jsonPath}`);
    process.exit(1);
  }

  // Create output directory if not exists
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Creating outputs directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const fileContent = fs.readFileSync(jsonPath, "utf8");
    const packs: PackData[] = JSON.parse(fileContent);

    console.log(`📂 Loaded ${packs.length} pack definitions from seed catalog.`);

    for (const pack of packs) {
      console.log(`⚙️  Generating procedural layers for: ${pack.name} (${pack.id})`);

      const baseSvg = generateBaseSvg(pack);
      const foilSvg = generateFoilSvg(pack);
      const glowSvg = generateGlowSvg(pack);

      fs.writeFileSync(path.join(outputDir, `${pack.id}.svg`), baseSvg, "utf8");
      fs.writeFileSync(path.join(outputDir, `${pack.id}_foil.svg`), foilSvg, "utf8");
      fs.writeFileSync(path.join(outputDir, `${pack.id}_glow.svg`), glowSvg, "utf8");
    }

    console.log("✨ All 20 pack SVG bundles successfully written to public/images/packs/!");
  } catch (error) {
    console.error("❌ SVG generation failed:", error);
    process.exit(1);
  }
}

// Execute directly if run via CLI
if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("generate-pack-assets.ts"))
) {
  generatePackAssets();
}
