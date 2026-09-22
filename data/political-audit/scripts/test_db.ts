import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:kxslIz4cICVDon%2FqwP2yrUzOKjtsryQDt9d28hmMjlk%3D@localhost:5433/ixstats?connection_limit=5",
    },
  },
});

async function main() {
  const catCount = await prisma.wikiCategory.count();
  const articleCount = await prisma.wikiArticle.count();
  console.log({ catCount, articleCount });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
