/**
 * A generated nation slot IS its country: renaming the slot's region in the Properties inspector renames the
 * nation too, in the transaction that renames the region. Only a slot no player holds follows its region; a held
 * nation and any country the world generator did not make keep their own names (a site admin's rename of those
 * is the router's own, older write).
 */
import { Prisma } from "@prisma/client";
import { freeNationSlug } from "./realms.claims";
import { RealmRegionError } from "./realms.region";

type RenameTx = Pick<Prisma.TransactionClient, "country" | "$queryRaw">;

const nameTaken = (name: string) =>
  new RealmRegionError("CONFLICT", `Another nation of this realm is already called ${name}`);

/**
 * A unique violation from a concurrent save, as the refusal it is: the (realm, name) pair taken since the check
 * above, or the new slug taken since the free-slug search (a retry finds the next one).
 */
function uniqueAsConflict(name: string) {
  return (error: Error): never => {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    if (String(error.meta?.target).includes("slug")) {
      throw new RealmRegionError(
        "CONFLICT",
        "The nation's URL slug was taken while it was being renamed; try again"
      );
    }
    throw nameTaken(name);
  };
}

/**
 * Rename the region's nation to `name` (trimmed) and regenerate its slug, inside the caller's transaction, when the
 * nation is a generated slot no player holds (its row is locked first, so a claim filed meanwhile waits for the
 * rename). Returns true when it is one (its name now matches the region's), false when the region has no nation or
 * keeps its name, or the nation is anything else: that is left alone. A name another nation of the realm carries
 * is a CONFLICT and nothing is written.
 */
export async function renameGeneratedSlot(
  tx: RenameTx,
  realmId: string,
  countryId: string | null,
  name: string | undefined
): Promise<boolean> {
  if (!countryId || name === undefined) return false;
  await tx.$queryRaw`SELECT id FROM "Country" WHERE id = ${countryId} FOR UPDATE`;
  const slot = await tx.country.findUnique({
    where: { id: countryId },
    select: {
      name: true,
      realmId: true,
      worldgen: true,
      ownerUserId: true,
      realm: { select: { slug: true } },
    },
  });
  if (slot?.realmId !== realmId || !slot.worldgen || slot.ownerUserId !== null) return false;

  const newName = name.trim();
  if (!newName) throw new RealmRegionError("BAD_REQUEST", "A nation needs a name");
  if (newName === slot.name) return true;

  const clash = await tx.country.findFirst({
    where: { realmId, name: newName, NOT: { id: countryId } },
    select: { id: true },
  });
  if (clash) throw nameTaken(newName);

  // The slot lets go of its own slug first, so the search never counts it as taking the new one
  await tx.country.update({ where: { id: countryId }, data: { slug: null } });
  const slug = await freeNationSlug(tx, { title: newName, realmSlug: slot.realm?.slug ?? realmId });
  await tx.country
    .update({ where: { id: countryId }, data: { name: newName, slug } })
    .catch(uniqueAsConflict(newName));
  return true;
}
