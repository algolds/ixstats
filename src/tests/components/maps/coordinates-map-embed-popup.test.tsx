import { buildPopupTitleNode } from "~/components/maps/widgets/CoordinatesMapEmbed";

describe("buildPopupTitleNode", () => {
  it("renders a wiki-supplied title as text, never as HTML", () => {
    const title = "<img src=x onerror=alert(1)>";
    const node = buildPopupTitleNode(title);

    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toBe(title);
  });

  it("keeps the popup styling", () => {
    const node = buildPopupTitleNode("Capital");
    expect(node.style.fontWeight).toBe("bold");
    expect(node.style.fontSize).toBe("12px");
  });
});
