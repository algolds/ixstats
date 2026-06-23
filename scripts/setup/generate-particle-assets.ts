import fs from "fs";
import path from "path";

const SVG_DIR = path.resolve("src/lib/particles");

const SVGS = {
  snowflake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="2" x2="12" y2="22"></line>
  <line x1="20" y1="12" x2="4" y2="12"></line>
  <path d="M20 4L4 20"></path>
  <path d="M4 4l16 16"></path>
  <path d="M12 4l3 3m-3-3l-3 3"></path>
  <path d="M12 20l3-3m-3 3l-3-3"></path>
  <path d="M20 12l-3-3m3 3l-3 3"></path>
  <path d="M4 12l3-3m-3 3l3 3"></path>
</svg>`,
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 2 7.5A7 7 0 0 1 11 20z"></path>
  <path d="M19 2L11 10"></path>
</svg>`,
  diamond: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(6,182,212,0.25)" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 3h12l4 6-10 12L2 9z"></path>
  <path d="M11 3 8 9l4 12 4-12-3-6"></path>
  <path d="M2 9h20"></path>
</svg>`,
  ruby: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(239,68,68,0.25)" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 2 9l10 13 10-13Z"></path>
  <path d="M12 22V2"></path>
  <path d="m2 9 10 3 10-3"></path>
</svg>`,
  emerald: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(16,185,129,0.25)" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8Z"></path>
  <path d="m2 8 6 4 8 0 6-4"></path>
  <path d="m2 16 6-4 8 0 6 4"></path>
</svg>`,
  sapphire: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(59,130,246,0.25)" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 3 7v10l9 5 9-5V7Z"></path>
  <path d="M12 2v20"></path>
  <path d="m3 7 9 5 9-5"></path>
  <path d="m3 17 9-5 9 5"></path>
</svg>`,
  "gold-coin": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(251,191,36,0.2)" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <circle cx="12" cy="12" r="6"></circle>
  <path d="M12 9v6m-2-4.5h3.5a1.5 1.5 0 0 1 0 3H10"></path>
</svg>`,
  crown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"></path>
  <path d="M5 20h14"></path>
</svg>`,
  trophy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
  <path d="M4 22h16"></path>
  <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
  <path d="M12 2a7 7 0 0 0-7 7v1.5a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z"></path>
</svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(251,191,36,0.3)" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
</svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
</svg>`,
  embassy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(6,182,212,0.2)" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 22h20"></path>
  <path d="M4 22V11h16v11"></path>
  <path d="M12 2 2 11h20Z"></path>
  <path d="M9 22v-6h6v6"></path>
</svg>`,
  scroll: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(217,119,6,0.2)" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v7"></path>
  <path d="M12 22h7a3 3 0 0 0 3-3V9c0-1.7-1.3-3-3-3h-7"></path>
  <path d="M12 6v16"></path>
</svg>`,
  "map-marker": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(239,68,68,0.25)" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
  <circle cx="12" cy="10" r="3"></circle>
</svg>`,
  "imperial-eagle": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(234,179,8,0.25)" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L9 6H4L6 11L3 13L8 15L7 21L12 18L17 21L16 15L21 13L18 11L20 6H15L12 2Z"></path>
  <path d="M12 6V18"></path>
  <path d="M9 10H15"></path>
</svg>`,
};

function main() {
  if (!fs.existsSync(SVG_DIR)) {
    fs.mkdirSync(SVG_DIR, { recursive: true });
  }

  let tsContent = `// Auto-generated SVG data URIs for tsParticles
// Generated on ${new Date().toISOString()}

`;

  for (const [name, content] of Object.entries(SVGS)) {
    const filePath = path.join(SVG_DIR, `${name}.svg`);
    fs.writeFileSync(filePath, content.trim() + "\n");
    console.log(`✅ Generated ${filePath}`);

    // Encode to base64
    const base64 = Buffer.from(content.trim()).toString("base64");
    const dataUri = `data:image/svg+xml;base64,${base64}`;

    // Format variable name
    const varName = `SVG_${name.toUpperCase().replace(/-/g, "_")}`;
    tsContent += `export const ${varName} = "${dataUri}";\n`;
  }

  const tsPath = path.join(SVG_DIR, "svg-data.ts");
  fs.writeFileSync(tsPath, tsContent);
  console.log(`✅ Generated central compilation file: ${tsPath}`);
}

main();
