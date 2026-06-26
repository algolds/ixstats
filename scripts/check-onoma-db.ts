import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  try {
    const totalCount = await db.nameBank.count();
    const dictionaryCount = await db.nameBank.count({
      where: { type: "dictionary" },
    });
    const publicDicts = await db.nameBank.findMany({
      where: { type: "dictionary", isPublic: true },
      select: {
        id: true,
        title: true,
        category: true,
        values: true,
      },
    });

    console.log(`Total NameBank records: ${totalCount}`);
    console.log(`Total dictionaries: ${dictionaryCount}`);
    console.log(`Total public dictionaries: ${publicDicts.length}`);
    console.log("\nPublic Dictionaries in DB:");
    for (const dict of publicDicts) {
      const valCount = Array.isArray(dict.values) ? dict.values.length : 0;
      console.log(
        `- ${dict.title} (ID: ${dict.id}, Category: ${dict.category}): ${valCount} words`
      );
    }
  } catch (err) {
    console.error("Error querying NameBank:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
