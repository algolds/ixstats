import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const dbs: any[] = await prisma.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datistemplate = false;");
  console.log("Databases in Postgres:", dbs.map(r => r.datname));

  const tables: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name;
  `);
  console.log(`Tables in current DB (${tables.length}):`);
  for (const t of tables) {
    if (t.table_name.includes('wiki') || t.table_name.includes('countr') || t.table_name.includes('part') || t.table_name.includes('gov')) {
      const cnt: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "${t.table_schema}"."${t.table_name}"`);
      console.log(`  - ${t.table_schema}.${t.table_name}: ${cnt[0].count} rows`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
