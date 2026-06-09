import * as mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.IXWIKI_DB_HOST || "localhost",
    port: Number(process.env.IXWIKI_DB_PORT) || 3306,
    user: process.env.IXWIKI_DB_USER || "ixwiki",
    password: process.env.IXWIKI_DB_PASSWORD || "",
    database: process.env.IXWIKI_DB_NAME || "ixwiki",
  });

  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `SELECT t.old_text
     FROM page p
     JOIN slots s ON s.slot_revision_id = p.page_latest
     JOIN content c ON c.content_id = s.slot_content_id
     JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
     WHERE p.page_title = 'OOL' AND p.page_namespace = 4
     LIMIT 1`
  );

  if (rows && rows.length > 0) {
    console.log("--- WIKITEXT OF IXWIKI:OOL ---");
    const text = rows[0]!.old_text instanceof Buffer ? rows[0]!.old_text.toString("utf-8") : String(rows[0]!.old_text);
    console.log(text);
    console.log("-----------------------------");
  } else {
    console.log("No main OOL page found in DB.");
  }

  await connection.end();
}

main().catch(console.error);
