import mysql from "mysql2/promise";
import dotenv from "dotenv";
import zlib from "zlib";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.IXWIKI_DB_HOST || "localhost",
    port: parseInt(process.env.IXWIKI_DB_PORT || "13306", 10),
    user: process.env.IXWIKI_DB_USER || "ixwiki",
    password: process.env.IXWIKI_DB_PASSWORD || "Multico1!",
    database: process.env.IXWIKI_DB_NAME || "ixwiki",
  });

  const [rows]: any = await conn.execute(`
    SELECT p.page_title, t.old_flags, t.old_text
    FROM page p
    JOIN revision r ON r.rev_id = p.page_latest
    JOIN slots s ON s.slot_revision_id = p.page_latest
    JOIN content c ON c.content_id = s.slot_content_id
    JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
    WHERE p.page_title IN ('Resistanceism', 'Universal_Nationalism', 'Counter_Empire', 'Limited_Divinity')
  `);

  for (const r of rows) {
    const title = r.page_title.toString();
    const flags = r.old_flags ? r.old_flags.toString() : "";
    let text = r.old_text;
    console.log(`\n=== ${title} (flags: ${flags}) ===`);
    
    // Test zlib inflate / inflateRaw
    const methods: Record<string, Function> = {
      gunzip: zlib.gunzipSync,
      inflate: zlib.inflateSync,
      inflateRaw: zlib.inflateRawSync,
    };

    for (const [name, fn] of Object.entries(methods)) {
      try {
        const res = fn(text).toString("utf-8");
        console.log(`  -> SUCCESS with ${name}! Length: ${res.length}, preview: ${res.slice(0, 150).replace(/\n/g, " ")}`);
        break;
      } catch (err: any) {
        // console.log(`  -> ${name} failed: ${err.message}`);
      }
    }
  }

  await conn.end();
}

main().catch(console.error);
