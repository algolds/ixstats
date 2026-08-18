import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";

const ZIP_URL = "https://game-icons.net/archives/svg/zip/ffffff/transparent/game-icons.net.svg.zip";
const TEMP_ZIP = "/tmp/game-icons.net.svg.zip";
const OUTPUT_DIR = join(process.cwd(), "public/icons/game-icons");
const MANIFEST_PATH = join(process.cwd(), "public/icons/game-icons-manifest.json");

export interface GameIconMeta {
  id: string;          // e.g. "lorc/crossed-swords"
  name: string;        // e.g. "Crossed Swords"
  slug: string;        // e.g. "crossed-swords"
  author: string;      // e.g. "lorc"
  path: string;        // e.g. "/icons/game-icons/lorc/crossed-swords.svg"
  tags: string[];      // generated keyword tags
}

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function generateTags(slug: string, author: string, folder: string): string[] {
  const parts = slug.toLowerCase().split("-");
  const tags = new Set<string>([...parts, author.toLowerCase()]);
  if (folder && folder !== author) {
    folder.toLowerCase().split("/").forEach(f => tags.add(f));
  }

  // Common category associations
  const s = slug.toLowerCase();
  if (s.includes("sword") || s.includes("blade") || s.includes("axe") || s.includes("shield") || s.includes("helm") || s.includes("armor") || s.includes("spear") || s.includes("bow") || s.includes("arrow") || s.includes("gun") || s.includes("cannon")) {
    tags.add("military");
    tags.add("combat");
    tags.add("weapon");
  }
  if (s.includes("crown") || s.includes("castle") || s.includes("palace") || s.includes("throne") || s.includes("king") || s.includes("queen") || s.includes("gavel") || s.includes("pillar") || s.includes("capitol") || s.includes("column")) {
    tags.add("government");
    tags.add("politics");
    tags.add("authority");
  }
  if (s.includes("scroll") || s.includes("laurel") || s.includes("quill") || s.includes("treaty") || s.includes("diploma") || s.includes("handshake") || s.includes("peace") || s.includes("feather")) {
    tags.add("diplomacy");
    tags.add("treaty");
    tags.add("documents");
  }
  if (s.includes("coin") || s.includes("cash") || s.includes("scale") || s.includes("gold") || s.includes("bank") || s.includes("money") || s.includes("chest") || s.includes("bag") || s.includes("gem") || s.includes("diamond")) {
    tags.add("economy");
    tags.add("finance");
    tags.add("wealth");
    tags.add("trade");
  }
  if (s.includes("sun") || s.includes("church") || s.includes("temple") || s.includes("cross") || s.includes("priest") || s.includes("halo") || s.includes("angel") || s.includes("pray") || s.includes("altar") || s.includes("god")) {
    tags.add("religion");
    tags.add("faith");
    tags.add("holy");
  }
  if (s.includes("compass") || s.includes("map") || s.includes("mountain") || s.includes("tree") || s.includes("forest") || s.includes("ocean") || s.includes("river") || s.includes("island") || s.includes("globe") || s.includes("earth")) {
    tags.add("geography");
    tags.add("nature");
    tags.add("world");
  }
  if (s.includes("flask") || s.includes("potion") || s.includes("atom") || s.includes("test") || s.includes("telescope") || s.includes("microscope") || s.includes("chemical") || s.includes("molecule") || s.includes("gear") || s.includes("machine")) {
    tags.add("science");
    tags.add("tech");
    tags.add("alchemy");
  }
  if (s.includes("book") || s.includes("music") || s.includes("lyre") || s.includes("art") || s.includes("mask") || s.includes("paint") || s.includes("drama") || s.includes("song") || s.includes("flute") || s.includes("harp")) {
    tags.add("culture");
    tags.add("arts");
    tags.add("music");
  }
  if (s.includes("flag") || s.includes("banner") || s.includes("pennant") || s.includes("emblem") || s.includes("insignia") || s.includes("crest") || s.includes("badge")) {
    tags.add("nation");
    tags.add("heraldry");
    tags.add("symbol");
  }
  if (s.includes("hour") || s.includes("time") || s.includes("ancient") || s.includes("fossil") || s.includes("clock") || s.includes("sand") || s.includes("ruin") || s.includes("pyramid") || s.includes("scroll")) {
    tags.add("history");
    tags.add("antiquity");
    tags.add("lore");
  }
  if (s.includes("person") || s.includes("face") || s.includes("man") || s.includes("woman") || s.includes("head") || s.includes("crowd") || s.includes("child") || s.includes("people") || s.includes("hood") || s.includes("cowled")) {
    tags.add("people");
    tags.add("character");
    tags.add("figure");
  }
  if (s.includes("star") || s.includes("magic") || s.includes("sparkle") || s.includes("crystal") || s.includes("orb") || s.includes("mystic") || s.includes("special") || s.includes("portal")) {
    tags.add("special");
    tags.add("arcane");
    tags.add("magic");
  }

  return Array.from(tags);
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (file.endsWith(".svg")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function main() {
  console.log("=== Game-Icons Pipeline ===");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Download zip if not already present or if output is empty
  const existingFiles = existsSync(OUTPUT_DIR) ? walkDir(OUTPUT_DIR) : [];
  if (existingFiles.length < 1000) {
    console.log(`Downloading ${ZIP_URL} to ${TEMP_ZIP}...`);
    execSync(`curl -sSL "${ZIP_URL}" -o "${TEMP_ZIP}"`, { stdio: "inherit" });

    console.log(`Extracting ${TEMP_ZIP} to ${OUTPUT_DIR}...`);
    execSync(`unzip -qo "${TEMP_ZIP}" -d "${OUTPUT_DIR}"`, { stdio: "inherit" });

    if (existsSync(TEMP_ZIP)) {
      unlinkSync(TEMP_ZIP);
    }
    console.log("Extraction complete.");
  } else {
    console.log(`Found existing ${existingFiles.length} SVGs in ${OUTPUT_DIR}.`);
  }

  // 2. Scan extracted SVGs
  const allSvgs = walkDir(OUTPUT_DIR);
  console.log(`Discovered ${allSvgs.length} SVG icon files.`);

  const manifest: GameIconMeta[] = [];

  for (const filePath of allSvgs) {
    const rel = relative(OUTPUT_DIR, filePath);
    // rel is e.g. "lorc/crossed-swords.svg" or "delapouite/castle.svg" or "000000/transparent/1x1/lorc/crossed-swords.svg"
    const segments = rel.split("/");
    const filename = segments[segments.length - 1]!;
    const slug = filename.replace(/\.svg$/, "");
    const author = segments.length > 1 ? segments[segments.length - 2]! : "general";
    const id = `${author}/${slug}`;
    const name = slugToName(slug);
    const webPath = `/icons/game-icons/${rel}`;
    const tags = generateTags(slug, author, segments.slice(0, -1).join("/"));

    manifest.push({
      id,
      name,
      slug,
      author,
      path: webPath,
      tags,
    });
  }

  manifest.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Writing manifest (${manifest.length} icons) to ${MANIFEST_PATH}...`);
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log("Manifest successfully written!");
}

main().catch(err => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
