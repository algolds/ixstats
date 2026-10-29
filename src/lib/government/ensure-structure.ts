/**
 * The bare GovernmentStructure row a governance consequence needs to land on: the issue or
 * directive moves a stored score, which is the lasting offset over the derived one (owner
 * decision 3). Created on first touch, as the stability row is, with no departments and no
 * budget, so every "no government yet" screen (keyed on departments) still offers to create the
 * structure, and `createGovernmentStructure` fills it in.
 */
import type { PrismaClient } from "@prisma/client";

type StructureDb = Pick<PrismaClient, "governmentStructure" | "country">;

/** True when the nation has (now) a structure row; false when the nation does not exist. */
export async function ensureGovernmentStructure(
  db: StructureDb,
  countryId: string
): Promise<boolean> {
  const existing = await db.governmentStructure.findUnique({
    where: { countryId },
    select: { id: true },
  });
  if (existing) return true;
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { name: true, governmentType: true },
  });
  if (!country) return false;
  await db.governmentStructure.upsert({
    where: { countryId },
    // The country's own type (blank stays blank), so the editor and the model read it as before.
    create: {
      countryId,
      governmentName: `Government of ${country.name}`,
      governmentType: country.governmentType ?? "",
    },
    update: {},
  });
  return true;
}
