import { describe, it, expect } from "@jest/globals";
import { assembleWikiImport } from "../lib/wiki-builder-assembler";
import { buildWikiImportState } from "../lib/wiki-import-state";

const ANTHEM =
  'A Portuguesa, Imnu ali Ripublică, "Hymn of the Republic"<div style="padding-top:0.5em;"></div>';
const CLEAN_ANTHEM = 'A Portuguesa, Imnu ali Ripublică, "Hymn of the Republic"';

const infobox = {
  name: "Pelaxia",
  official_name: "Republic of Pelaxia<br />Ripublică Pelaxia",
  motto: 'Unity<div style="padding-top:0.5em;"></div>',
  national_anthem: ANTHEM,
  capital: "Porto Alto<br>",
  largest_city: "Vila Nova<div></div>",
  demonym: "Pelaxian<div></div>",
  currency: "Pelaxian dollar<br/>",
  head_of_state: "President X<div></div>",
  head_of_government: "Prime Minister Y<br>",
  legislature: "National Assembly<div></div>",
};

describe("wiki import identity fields", () => {
  it("strips html from the identity the assembler builds", async () => {
    const { economicInputs, governmentStructure } = await assembleWikiImport({
      infoboxData: infobox,
      pages: [],
    });
    const identity = economicInputs.nationalIdentity;
    expect(identity?.nationalAnthem).toBe(CLEAN_ANTHEM);
    expect(identity?.officialName).toBe("Republic of Pelaxia, Ripublică Pelaxia");
    expect(identity?.motto).toBe("Unity");
    expect(identity?.capitalCity).toBe("Porto Alto");
    expect(identity?.largestCity).toBe("Vila Nova");
    expect(identity?.demonym).toBe("Pelaxian");
    expect(identity?.currency).toBe("Pelaxian dollar");
    expect(governmentStructure.structure?.headOfState).toBe("President X");
    expect(governmentStructure.structure?.headOfGovernment).toBe("Prime Minister Y");
    expect(governmentStructure.structure?.legislatureName).toBe("National Assembly");
  });

  it("strips html from the identity built from the stored import payload", () => {
    const state = buildWikiImportState(infobox);
    const identity = state.economicInputs?.nationalIdentity;
    expect(identity?.nationalAnthem).toBe(CLEAN_ANTHEM);
    expect(identity?.officialName).toBe("Republic of Pelaxia, Ripublică Pelaxia");
    expect(identity?.motto).toBe("Unity");
    expect(identity?.capitalCity).toBe("Porto Alto");
    expect(identity?.demonym).toBe("Pelaxian");
    expect(state.governmentStructure?.structure?.headOfState).toBe("President X");
    expect(state.governmentStructure?.structure?.legislatureName).toBe("National Assembly");
  });

  it("falls back to the next source when a field is only markup", () => {
    const state = buildWikiImportState({
      name: "Pelaxia",
      official_name: "<div></div>",
      conventional_long_name: "Republic of Pelaxia",
    });
    expect(state.economicInputs?.nationalIdentity?.officialName).toBe("Republic of Pelaxia");
  });
});
