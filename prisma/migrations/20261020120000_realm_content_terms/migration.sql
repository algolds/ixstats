-- Realm content terms (ToS §2.6–§2.8): the consent a claim records, the owner's inactivity notice, and the material a
-- released nation holds hidden until its former holder reclaims it or the hold is purged.
ALTER TABLE "realm_claims" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "realm_claims" ADD COLUMN "consentAt" TIMESTAMP(3);
ALTER TABLE "realm_claims" ADD COLUMN "consentBasis" TEXT;
ALTER TABLE "realm_claims" ADD COLUMN "permissionNote" TEXT;

ALTER TABLE "Country" ADD COLUMN "inactivityNoticeAt" TIMESTAMP(3);

CREATE TABLE "nation_material_holds" (
    "countryId" TEXT NOT NULL,
    "formerOwnerUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "flag" TEXT,
    "coatOfArms" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nation_material_holds_pkey" PRIMARY KEY ("countryId")
);

CREATE INDEX "nation_material_holds_purgeAfter_idx" ON "nation_material_holds"("purgeAfter");

ALTER TABLE "nation_material_holds" ADD CONSTRAINT "nation_material_holds_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
