/**
 * Tests for format-utils.ts - Currency formatting with custom currency support
 */

import {
  formatCurrency,
  formatExactCurrency,
  safeFormatCurrency,
  getAvailableCurrencies,
  getCurrencyInfo,
  isValidCurrency,
  registerCustomCurrency,
} from "~/lib/utils";

describe("Currency Formatting", () => {
  describe("ISO Currency Support", () => {
    test("formats USD correctly", () => {
      expect(formatCurrency(1234, "USD")).toBe("$1.2K");
      expect(formatCurrency(1234567, "USD")).toBe("$1.2M");
      expect(formatCurrency(1234567890, "USD")).toBe("$1.2B");
    });
  });

  describe("Custom Currency Support", () => {
    test("formats Taler correctly", () => {
      expect(formatCurrency(1234, "Taler")).toBe("₮1.2K");
      expect(formatCurrency(1234567, "Taler")).toBe("₮1.23M");
      expect(formatCurrency(1234567890, "Taler")).toBe("₮1.23B");
    });
    test("formats unknown custom currency with fallback", () => {
      expect(formatCurrency(1234, "CustomCoin")).toBe("CustomCoin 1.2K");
      expect(formatCurrency(1234567, "CustomCoin")).toBe("CustomCoin 1.23M");
    });
  });

  describe("Safe Currency Formatting", () => {
    test("handles invalid currency with fallback", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      expect(safeFormatCurrency(1234, "InvalidCurrency", false, "USD")).toBe("$1.2K");
      warnSpy.mockRestore();
    });
  });

  describe("Currency Validation", () => {
    test("validates ISO currencies", () => {
      expect(isValidCurrency("USD")).toBe(true);
      expect(isValidCurrency("EUR")).toBe(true);
      expect(isValidCurrency("GBP")).toBe(true);
    });
    test("rejects invalid currencies", () => {
      expect(isValidCurrency("INVALID")).toBe(false);
      expect(isValidCurrency("")).toBe(false);
    });
  });

  describe("Currency Information", () => {
    test("gets ISO currency info", () => {
      const info = getCurrencyInfo("USD");
      expect(info.isISO).toBe(true);
    });
    test("handles unknown currency", () => {
      const info = getCurrencyInfo("Unknown");
      expect(info.isISO).toBe(false);
      expect(info.symbol).toBeUndefined();
      expect(info.name).toBeUndefined();
    });
  });

  describe("Available Currencies", () => {
    test("includes ISO currencies", () => {
      const currencies = getAvailableCurrencies();
      expect(currencies).toContain("USD");
      expect(currencies).toContain("EUR");
      expect(currencies).toContain("GBP");
    });
  });

  describe("Exact Currency Formatting", () => {
    test("formats exact amounts with ISO currencies", () => {
      expect(formatExactCurrency(1234567, "USD")).toBe("$1,234,567");
    });
    test("formats exact amounts with unknown currencies", () => {
      expect(formatExactCurrency(1234567, "CustomCoin")).toBe("CustomCoin 1,234,567");
    });
  });

  describe("Edge Cases", () => {
    test("handles zero amounts", () => {
      expect(formatCurrency(0, "USD")).toBe("$0");
      expect(formatCurrency(0, "Taler")).toBe("₮0");
    });

    test("handles negative amounts", () => {
      expect(formatCurrency(-1234, "USD")).toBe("-$1.2K");
      expect(formatCurrency(-1234, "Taler")).toBe("₮-1.2K");
    });
    test("handles very large amounts", () => {
      expect(formatCurrency(1e15, "USD")).toBe("$1,000.0T");
      expect(formatCurrency(1e15, "Taler")).toBe("₮1,000.0T");
    });
  });

  describe("Dynamic Custom Currency Registration", () => {
    test("registers and formats custom currency correctly", () => {
      registerCustomCurrency("GoldCoin", "⚜");
      expect(isValidCurrency("GoldCoin")).toBe(true);

      const info = getCurrencyInfo("GoldCoin");
      expect(info.isISO).toBe(false);
      expect(info.symbol).toBe("⚜");

      expect(formatCurrency(1234, "GoldCoin")).toBe("⚜1.2K");
      expect(formatExactCurrency(1234, "GoldCoin")).toBe("⚜1,234");
    });
  });
});
