import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  try {
    const tables: any = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    console.log('=== Database Tables ===');
    for (const t of tables) {
      console.log(`- ${t.table_name}`);
    }
  } catch (error) {
    console.error('Error querying tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
