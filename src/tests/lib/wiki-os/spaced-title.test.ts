import { spacedTitle } from "~/lib/wiki-os/core/title";

describe("spacedTitle", () => {
  it("reads every underscore as a space and changes nothing else", () => {
    expect(spacedTitle("Senate_of__Caphiria")).toBe("Senate of  Caphiria");
    expect(spacedTitle("already spaced")).toBe("already spaced");
    expect(spacedTitle(" lower_case ")).toBe(" lower case ");
  });
});
