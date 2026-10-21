/**
 * The passport front face shows only known facts: the payload handle, the primary nation line with
 * its realm role, a three-stat row that drops unknown cells, and an unlabelled signature.
 */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/components/vault/CosmeticParticles", () => ({ CosmeticParticles: () => null }));

import {
  PassportFrontFace,
  type PassportFaceData,
} from "~/components/passport/document/PassportFrontFace";

function face(over: Partial<PassportFaceData> = {}): PassportFaceData {
  return {
    handle: "alexpav",
    online: false,
    realmCount: 2,
    nationCount: 3,
    primaryNation: {
      name: "Ixnay",
      slug: "ixnay",
      role: "founder",
      country: { name: "Caphiria", slug: "caphiria", flagUrl: "https://example.com/flag.png" },
    },
    account: { createdAt: "2025-10-04T12:00:00.000Z", signature: "A. Pav" },
    wiki: { lorewards: { totalScore: 1200, rank: 3 } },
    thinkpages: { bio: "Cartographer of the southern sea." },
    ...over,
  };
}

interface RenderOptions {
  data?: PassportFaceData;
  isOwner?: boolean;
  viewerSignedIn?: boolean;
}

function renderFace({ data = face(), isOwner = false, viewerSignedIn = true }: RenderOptions = {}) {
  const onEdit = jest.fn();
  const onOpenLorewards = jest.fn();
  const view = render(
    <PassportFrontFace
      data={data}
      displayName="Alex Pav"
      avatarUrl={null}
      cosmetics={null}
      isOwner={isOwner}
      viewerSignedIn={viewerSignedIn}
      onEdit={onEdit}
      onOpenLorewards={onOpenLorewards}
    />
  );
  return { ...view, onEdit, onOpenLorewards };
}

describe("PassportFrontFace", () => {
  it("omits the Lorewards cell when Lorewards are unknown or hidden", () => {
    const { container } = renderFace({ data: face({ wiki: { lorewards: null } }) });
    expect(screen.queryByRole("button", { name: /lorewards/i })).toBeNull();
    expect(container.textContent).not.toMatch(/lorewards/i);
    expect(container.textContent).not.toMatch(/unranked/i);
  });

  it("shows Lorewards rank and score and opens the Lorewards sheet", () => {
    const { onOpenLorewards } = renderFace();
    const cell = screen.getByRole("button", { name: /lorewards/i });
    expect(cell).toHaveTextContent("#3");
    expect(cell).toHaveTextContent("1,200 pts");
    fireEvent.click(cell);
    expect(onOpenLorewards).toHaveBeenCalledTimes(1);
  });
  it("shows Edit to the owner and no Message", () => {
    const { onEdit } = renderFace({ isOwner: true });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Message" })).toBeNull();
  });

  it("shows Message to another signed-in viewer, addressed to the payload handle", () => {
    renderFace({ data: face({ handle: "canonical_handle" }) });
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute(
      "href",
      "/messages?user=canonical_handle"
    );
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("shows neither Edit nor Message to a signed-out viewer", () => {
    renderFace({ viewerSignedIn: false });
    expect(screen.queryByRole("link", { name: "Message" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("copies the canonical passport link on Share", async () => {
    const writeText = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderFace({ data: face({ handle: "canonical_handle" }) });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/@canonical_handle`)
    );
  });
});
