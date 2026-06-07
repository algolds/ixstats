import { appRouter } from "../src/server/api/root";
import { createTRPCContext } from "../src/server/api/trpc";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ctx = {
    db: prisma,
    auth: { userId: null },
    user: null,
    headers: new Headers(),
  };

  const caller = appRouter.createCaller(ctx);
  const result = await caller.geoCore.getWorldMap({ layers: ["political"] });
  const political = result.political;

  console.log("Political FeatureCollection features count:", political.features.length);

  const castadillaFeatures = political.features.filter(
    (f: any) => f.properties?._displayName === "Castadilla" || f.properties?._id === "Castadilla"
  );
  console.log("Castadilla Features:", JSON.stringify(castadillaFeatures, null, 2));

  const caphiriaFeatures = political.features.filter(
    (f: any) => f.properties?._displayName === "Caphiria" || f.properties?._id === "Caphiria"
  );
  console.log("Caphiria Features:", JSON.stringify(caphiriaFeatures, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
