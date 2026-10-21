import { identityFieldError } from "~/lib/mycountry/editor-fields";
describe("identity field checks", () => {
  it("accepts empty values and well-formed codes", () => {
    expect(identityFieldError("isoCode", "")).toBeNull();
    expect(identityFieldError("isoCode", "EL")).toBeNull();
    expect(identityFieldError("internetTLD", ".el")).toBeNull();
    expect(identityFieldError("callingCode", "+35")).toBeNull();
    expect(identityFieldError("drivingSide", "left")).toBeNull();
  });
});
