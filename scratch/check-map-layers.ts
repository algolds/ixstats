import { promises as fs } from "fs";
import { join } from "path";

async function main() {
  const filePath = join(process.cwd(), "scripts", "geojson_fixed", "political.geojson");
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  const matching = parsed.features.filter((f: any) => {
    const p = f.properties;
    if (!p) return false;
    return Object.values(p).some(
      (val: any) => typeof val === "string" && val.toLowerCase().includes("kabasa")
    );
  });

  console.log("Matching features in political.geojson:", JSON.stringify(matching, null, 2));
}

main().catch(console.error);
