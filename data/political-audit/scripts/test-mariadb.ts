import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const IXWIKI_DB_HOST = process.env.IXWIKI_DB_HOST || "localhost";
const IXWIKI_DB_PORT = parseInt(process.env.IXWIKI_DB_PORT || "13306", 10);
const IXWIKI_DB_USER = process.env.IXWIKI_DB_USER || "ixwiki";
const IXWIKI_DB_PASSWORD = process.env.IXWIKI_DB_PASSWORD || "Multico1!";
const IXWIKI_DB_NAME = process.env.IXWIKI_DB_NAME || "ixwiki";

async function main() {
  console.log(`Connecting to MariaDB at ${IXWIKI_DB_HOST}:${IXWIKI_DB_PORT}/${IXWIKI_DB_NAME}...`);
  try {
    const conn = await mysql.createConnection({
      host: IXWIKI_DB_HOST,
      port: IXWIKI_DB_PORT,
      user: IXWIKI_DB_USER,
      password: IXWIKI_DB_PASSWORD,
      database: IXWIKI_DB_NAME,
      charset: "utf8mb4",
      connectTimeout: 5000,
    });
    console.log("Connected to MariaDB successfully!");
    const [rows]: any = await conn.execute("SELECT count(*) as count FROM page WHERE page_namespace = 0");
    console.log("Article count in MariaDB:", rows[0].count);
    await conn.end();
  } catch (err: any) {
    console.log("MariaDB connection failed on port 13306:", err.message);
    // try port 3306
    try {
      console.log("Trying port 3306...");
      const conn = await mysql.createConnection({
        host: "localhost",
        port: 3306,
        user: IXWIKI_DB_USER,
        password: IXWIKI_DB_PASSWORD,
        database: IXWIKI_DB_NAME,
        charset: "utf8mb4",
        connectTimeout: 5000,
      });
      console.log("Connected to MariaDB on 3306 successfully!");
      const [rows]: any = await conn.execute("SELECT count(*) as count FROM page WHERE page_namespace = 0");
      console.log("Article count in MariaDB (3306):", rows[0].count);
      await conn.end();
    } catch (err2: any) {
      console.log("MariaDB connection failed on port 3306:", err2.message);
    }
  }
}

main();
