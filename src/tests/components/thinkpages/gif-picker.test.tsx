/**
 * The GIF picker uses the deployment's own Giphy key (NEXT_PUBLIC_GIPHY_API_KEY) and, without one, stays disabled
 * and never calls Giphy (there is no shared fallback key in the bundle).
 */
import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import type { GifPicker as GifPickerType } from "~/components/thinkpages/GifPicker";

describe("GifPicker without a Giphy key", () => {
  it("is disabled, says why, and calls nothing", () => {
    const saved = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    delete process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    const fetchMock = jest.spyOn(global, "fetch");
    try {
      // Loaded after the variable is cleared: the key is read when the module loads
      const { GifPicker } = jest.requireActual("~/components/thinkpages/GifPicker") as {
        GifPicker: typeof GifPickerType;
      };
      render(<GifPicker onSelectGif={() => undefined} />);
      const button = screen.getByRole("button", { name: "Insert GIF" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "GIFs are not set up on this server");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      if (saved !== undefined) process.env.NEXT_PUBLIC_GIPHY_API_KEY = saved;
    }
  });
});
