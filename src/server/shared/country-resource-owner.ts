/**
 * Ownership resolvers for country-owned rows (Plan 332).
 *
 * Each resolver does one `findUnique` with a minimal `select` and returns the
 * owning countryId, or null when the row (or its link to a country) is missing.
 * Pair with `assertCountryResourceWriteAccess` from ./country-authorization.
 */
import type { PrismaClient } from "@prisma/client";

export async function resolveMeetingCountryId(
  db: { cabinetMeeting: Pick<PrismaClient["cabinetMeeting"], "findUnique"> },
  meetingId: string
): Promise<string | null> {
  const meeting = await db.cabinetMeeting.findUnique({
    where: { id: meetingId },
    select: { countryId: true },
  });
  return meeting?.countryId ?? null;
}

export async function resolveStructureCountryId(
  db: { governmentStructure: Pick<PrismaClient["governmentStructure"], "findUnique"> },
  governmentStructureId: string
): Promise<string | null> {
  const structure = await db.governmentStructure.findUnique({
    where: { id: governmentStructureId },
    select: { countryId: true },
  });
  return structure?.countryId ?? null;
}

export async function resolveDepartmentCountryId(
  db: { governmentDepartment: Pick<PrismaClient["governmentDepartment"], "findUnique"> },
  departmentId: string
): Promise<string | null> {
  const department = await db.governmentDepartment.findUnique({
    where: { id: departmentId },
    select: { governmentStructure: { select: { countryId: true } } },
  });
  return department?.governmentStructure.countryId ?? null;
}

/** An official hangs off a structure, a department, or both; the structure wins. */
export async function resolveOfficialCountryId(
  db: { governmentOfficial: Pick<PrismaClient["governmentOfficial"], "findUnique"> },
  officialId: string
): Promise<string | null> {
  const official = await db.governmentOfficial.findUnique({
    where: { id: officialId },
    select: {
      governmentStructure: { select: { countryId: true } },
      department: { select: { governmentStructure: { select: { countryId: true } } } },
    },
  });
  return (
    official?.governmentStructure?.countryId ??
    official?.department?.governmentStructure.countryId ??
    null
  );
}

/**
 * A transport route's country, but only when the route belongs to `countryId`
 * (the country the caller named). A mismatched pair resolves to null → NOT_FOUND,
 * so an owner cannot touch another country's route by sending their own countryId.
 */
export async function resolveTransportRouteCountryId(
  db: { transportRoute: Pick<PrismaClient["transportRoute"], "findFirst"> },
  routeId: string,
  countryId: string
): Promise<string | null> {
  const route = await db.transportRoute.findFirst({
    where: { id: routeId, countryId },
    select: { countryId: true },
  });
  return route?.countryId ?? null;
}
