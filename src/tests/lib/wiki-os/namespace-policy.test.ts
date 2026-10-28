/** @jest-environment node */
import { isTemplateTitle } from "~/lib/wiki-os/namespace-policy";

describe("isTemplateTitle", () => {
  it("is true for Template: pages only, however the prefix is written", () => {
    expect(isTemplateTitle("Template:Infobox country")).toBe(true);
    expect(isTemplateTitle("template: Further")).toBe(true);
    expect(isTemplateTitle("Template talk:Infobox country")).toBe(false);
    expect(isTemplateTitle("Templates of Burgundie")).toBe(false);
    expect(isTemplateTitle("Burgundie")).toBe(false);
  });
});
