/**
 * The passport front face shows only known facts: the payload handle, the primary nation line with
 * its realm role, a three-stat row that drops unknown cells, and an unlabelled signature.
 */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/components/vault/CosmeticParticles", () => ({ CosmeticParticles: () => null }));

import {
  PassportFrontFace,
  type PassportFaceData,
} from "~/components/passport/document/PassportFrontFace";
import { realmsAndNations, sinceLabel } from "~/lib/passport/passport-labels";

function face(over: Partial<PassportFaceData> = {}): PassportFaceData {
  return {
    handle: "alexpav",
    online: false,
    realmCount: 2,
    nationCount: 3,
    primaryNation: {
      name: "IxWorld",
      slug: "ixworld",
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

describe("realmsAndNations", () => {
  it("uses singular forms for one", () => {
    expect(realmsAndNations(1, 1)).toBe("1 realm · 1 nation");
  });

  it("uses plural forms otherwise", () => {
    expect(realmsAndNations(2, 3)).toBe("2 realms · 3 nations");
  });

  it("is omitted when no nation is held", () => {
    expect(realmsAndNations(0, 0)).toBeNull();
  });
});

describe("sinceLabel", () => {
  it("reads as a short month and year", () => {
    expect(sinceLabel("2025-10-04T12:00:00.000Z")).toBe("Since Oct 2025");
  });

  it("is omitted when the join date is unknown or invalid", () => {
    expect(sinceLabel(null)).toBeNull();
    expect(sinceLabel("not a date")).toBeNull();
  });
});

describe("PassportFrontFace", () => {
  it("titles the document IxStates Passport", () => {
    renderFace();
    expect(screen.getByRole("heading", { name: "IxStates Passport" })).toBeInTheDocument();
  });

  it("never renders the generated identity number or a status stat", () => {
    const { container } = renderFace();
    expect(screen.queryByText(/identity no/i)).toBeNull();
    expect(container.textContent).not.toMatch(/identity no/i);
    expect(container.textContent).not.toMatch(/status/i);
    expect(container.textContent).not.toContain("—");
  });

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

  it("shows the score without a rank when the holder is unranked", () => {
    renderFace({ data: face({ wiki: { lorewards: { totalScore: 40, rank: null } } }) });
    const cell = screen.getByRole("button", { name: /lorewards/i });
    expect(cell).toHaveTextContent("40 pts");
    expect(cell).not.toHaveTextContent("#");
  });

  it("writes realm and nation counts in singular and plural", () => {
    const { unmount } = renderFace({ data: face({ realmCount: 1, nationCount: 1 }) });
    expect(screen.getByText("1 realm · 1 nation")).toBeInTheDocument();
    unmount();
    renderFace();
    expect(screen.getByText("2 realms · 3 nations")).toBeInTheDocument();
  });

  it("omits the realm cell when no nation is held and the join cell when the date is unknown", () => {
    const { container } = renderFace({
      data: face({
        realmCount: 0,
        nationCount: 0,
        primaryNation: null,
        account: { createdAt: null, signature: null },
      }),
    });
    expect(container.textContent).not.toMatch(/realms?\b/);
    expect(container.textContent).not.toMatch(/since/i);
    expect(container.textContent).not.toMatch(/recent/i);
  });

  it("draws stat dividers only in the single-row grid that cannot wrap", () => {
    renderFace();
    const row = screen.getByText("Since Oct 2025").parentElement;
    const classes = row?.className.split(/\s+/) ?? [];
    expect(classes.filter((c) => c.includes("divide-x"))).toEqual(["lg:divide-x"]);
    expect(classes).toEqual(expect.arrayContaining(["lg:grid", "lg:grid-flow-col"]));
  });

  it("shows the join month", () => {
    renderFace();
    expect(screen.getByText("Since Oct 2025")).toBeInTheDocument();
  });

  it("shows the signature in serif with no label", () => {
    const { container } = renderFace();
    const signature = screen.getByText("A. Pav");
    expect(signature.className).toContain("font-serif");
    expect(container.textContent).not.toMatch(/signature/i);
  });

  it("does not invent a signature when none is saved", () => {
    const { container } = renderFace({
      data: face({ account: { createdAt: null, signature: null } }),
    });
    expect(container.querySelector(".font-serif")).toBeNull();
  });

  it("shows the ThinkPages bio as a footer line with no label", () => {
    const { container } = renderFace();
    expect(screen.getByText("Cartographer of the southern sea.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/thinkpages bio/i);
  });

  it("shows the payload handle", () => {
    renderFace({ data: face({ handle: "canonical_handle" }) });
    expect(
      screen.getByRole("button", { name: /copy handle @canonical_handle/i })
    ).toHaveTextContent("@canonical_handle");
  });

  it("shows the primary nation, its realm and a founder role", () => {
    renderFace();
    const line = screen.getByTestId("passport-nation-line");
    expect(within(line).getByRole("link", { name: "Caphiria" })).toHaveAttribute(
      "href",
      "/countries/caphiria"
    );
    expect(within(line).getByRole("link", { name: "IxWorld" })).toHaveAttribute(
      "href",
      "/r/ixworld"
    );
    expect(line).toHaveTextContent("Founder");
  });

  it("labels no role for a plain member", () => {
    const base = face();
    const nation = base.primaryNation ? { ...base.primaryNation, role: "member" as const } : null;
    renderFace({ data: face({ primaryNation: nation }) });
    const line = screen.getByTestId("passport-nation-line");
    expect(line).not.toHaveTextContent(/founder|officer|member/i);
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
