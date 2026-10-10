/**
 * The Appearance section's emblem field: the same image field as the banner and thumbnail, saved through
 * updateAppearance with the others, clearable, and checked like them before Save is allowed.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const mutate = jest.fn();
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/lib/media/upload-image", () => ({ uploadImageFile: jest.fn() }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      realms: { region: { invalidate: jest.fn() }, directory: { invalidate: jest.fn() } },
    }),
    realms: { region: { updateAppearance: { useMutation: () => ({ mutate, isPending: false }) } } },
  },
}));

import { AppearanceSection } from "~/app/r/[realm]/_components/manage/AppearanceSection";

function renderSection(emblemUrl: string | null = null) {
  render(
    <AppearanceSection
      slug="eurth"
      appearance={{ bannerUrl: null, thumbnail: null, emblemUrl, description: null, tags: [] }}
    />
  );
}

beforeEach(() => mutate.mockClear());

describe("AppearanceSection emblem", () => {
  it("offers the emblem beside the banner and thumbnail, with an upload", () => {
    renderSection();
    expect(screen.getByLabelText("Emblem")).toBeTruthy();
    expect(screen.getByLabelText("Upload emblem")).toBeTruthy();
  });

  it("saves the emblem with the other appearance fields", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("Emblem"), {
      target: { value: "https://img.example/emblem.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "eurth", emblemUrl: "https://img.example/emblem.png" })
    );
  });

  it("clears the emblem by saving it empty", () => {
    renderSection("https://img.example/emblem.png");
    fireEvent.change(screen.getByLabelText("Emblem"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ emblemUrl: null }));
  });

  it("blocks Save while the emblem is not an https or uploaded image address", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("Emblem"), {
      target: { value: "http://img.example/e.png" },
    });
    expect(
      (screen.getByRole("button", { name: "Save appearance" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
