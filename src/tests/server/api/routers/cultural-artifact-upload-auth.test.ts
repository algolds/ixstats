jest.mock("~/lib/diplomacy/choice-tracker", () => ({
  DiplomaticChoiceTracker: { recordChoice: jest.fn().mockResolvedValue(undefined) },
}));

import { diplomaticCulturalLifecycleParticipationRouter } from "~/server/api/routers/diplomacy/cultural/lifecycle/participation";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

function uploadDb(hostCountryId: string, participantRow: { id: string } | null) {
  return {
    culturalExchange: {
      findUnique: jest.fn().mockResolvedValue({
        hostCountryId,
        hostCountryName: "Host",
        type: "festival",
      }),
    },
    culturalExchangeParticipant: { findFirst: jest.fn().mockResolvedValue(participantRow) },
    culturalArtifact: { create: jest.fn().mockResolvedValue({ id: "artifact_1" }) },
  };
}

const upload = {
  exchangeId: "ex_1",
  type: "photo" as const,
  title: "Harvest",
  fileUrl: "https://example.com/a.png",
  contributor: "Caller",
};

describe("diplomaticCultural.uploadCulturalArtifact authorization", () => {
  it("lets the exchange host upload without a participant row", async () => {
    const db = uploadDb(CALLER_COUNTRY, null);
    const caller = diplomaticCulturalLifecycleParticipationRouter.createCaller(
      createIdorContext(db)
    );
    await expect(caller.uploadCulturalArtifact(upload)).resolves.toEqual({ id: "artifact_1" });
    expect(db.culturalArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ exchangeId: "ex_1", countryId: CALLER_COUNTRY }),
    });
  });

  it("lets a participant country upload", async () => {
    const db = uploadDb(FOREIGN_COUNTRY, { id: "participant_1" });
    const caller = diplomaticCulturalLifecycleParticipationRouter.createCaller(
      createIdorContext(db)
    );
    await expect(caller.uploadCulturalArtifact(upload)).resolves.toEqual({ id: "artifact_1" });
    expect(db.culturalExchangeParticipant.findFirst).toHaveBeenCalledWith({
      where: { exchangeId: "ex_1", countryId: CALLER_COUNTRY },
    });
    expect(db.culturalArtifact.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a country that is neither host nor participant", async () => {
    const db = uploadDb(FOREIGN_COUNTRY, null);
    const caller = diplomaticCulturalLifecycleParticipationRouter.createCaller(
      createIdorContext(db)
    );
    await expect(caller.uploadCulturalArtifact(upload)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.culturalArtifact.create).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing exchange", async () => {
    const db = uploadDb(CALLER_COUNTRY, null);
    db.culturalExchange.findUnique.mockResolvedValue(null);
    const caller = diplomaticCulturalLifecycleParticipationRouter.createCaller(
      createIdorContext(db)
    );
    await expect(caller.uploadCulturalArtifact(upload)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.culturalArtifact.create).not.toHaveBeenCalled();
  });
});
