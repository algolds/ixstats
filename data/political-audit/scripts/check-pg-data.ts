import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const countries = await prisma.country.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      governmentType: true,
      religion: true,
      leader: true,
      wikiPageTitle: true,
      politicalParties: {
        select: {
          id: true,
          name: true,
          shortName: true,
          ideology: true,
          platform: true,
          baseSupport: true,
          currentSupport: true,
        },
      },
      legislature: {
        select: {
          id: true,
          name: true,
          chamberType: true,
          totalSeats: true,
          electoralSystem: true,
        },
      },
      governmentStructure: {
        select: {
          governmentName: true,
          governmentType: true,
          headOfState: true,
          headOfGovernment: true,
          legislatureName: true,
          executiveName: true,
          judicialName: true,
          branches: {
            select: {
              name: true,
              branchType: true,
              description: true,
            },
          },
        },
      },
      governmentComponents: {
        select: {
          componentType: true,
          effectivenessScore: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${countries.length} countries in PostgreSQL Country table.`);
  fs.writeFileSync("/tmp/pg_countries_audit.json", JSON.stringify(countries, null, 2));

  // Check all political parties across DB
  const totalParties = countries.reduce((acc, c) => acc + c.politicalParties.length, 0);
  console.log(`Found ${totalParties} political parties across ${countries.length} countries.`);

  // Check wiki_articles count and all distinct titles/categories
  const allWikiArticles = await prisma.wikiArticle.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      infoboxData: true,
      categories: {
        include: {
          category: true,
        },
      },
    },
  });
  console.log(`Total wiki_articles in PostgreSQL: ${allWikiArticles.length}`);
  fs.writeFileSync(
    "/tmp/pg_wiki_articles_audit.json",
    JSON.stringify(
      allWikiArticles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        infobox: a.infoboxData,
        categories: a.categories.map((c) => c.category.name),
      })),
      null,
      2
    )
  );

  console.log("Exported data to /tmp/pg_countries_audit.json and /tmp/pg_wiki_articles_audit.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
