/**
 * "Suggest one" reads signals the country record has: low stability points at Security, low
 * approval at Social, otherwise nothing stands out.
 */
import { suggestedDomain } from "~/components/mycountry/directives/directive-model";

it("answers the weakest real signal", () => {
  expect(suggestedDomain({ stabilityScore: 35, publicApproval: 30 })).toBe("Security");
  expect(suggestedDomain({ stabilityScore: 70, publicApproval: 30 })).toBe("Social");
  expect(suggestedDomain({ stabilityScore: 70, publicApproval: 70 })).toBeNull();
  expect(suggestedDomain({})).toBeNull();
});
