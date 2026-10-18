/** @jest-environment node */
import { listingRefund, MAX_LISTING_PRICE, royaltyFromFee, saleFee } from "~/lib/cards/market/fees";

const rule = { ratePct: 10, threshold: 100 };

describe("market fees", () => {
  it("charges 10% of sales over 100 IxC, rounded down", () => {
    expect(saleFee(100, rule)).toBe(0);
    expect(saleFee(101, rule)).toBe(10);
    expect(saleFee(1005, rule)).toBe(100);
    expect(saleFee(MAX_LISTING_PRICE, rule)).toBe(100_000);
  });

  it("clamps the rate to 0..50%", () => {
    expect(saleFee(1000, { ratePct: 90, threshold: 100 })).toBe(500);
    expect(saleFee(1000, { ratePct: 50, threshold: 100 })).toBe(500);
    expect(saleFee(1000, { ratePct: -5, threshold: 100 })).toBe(0);
  });

  it("works the fee out exactly, with no float shortfall", () => {
    expect(saleFee(200, { ratePct: 29, threshold: 100 })).toBe(58);
    expect(saleFee(1000, { ratePct: 7.5, threshold: 100 })).toBe(75);
    expect(saleFee(500, { ratePct: 10, threshold: 500 })).toBe(0);
    expect(saleFee(501, { ratePct: 10, threshold: 500 })).toBe(50);
  });

  it("pays the royalty out of the fee: 2% in cents, never above the fee, nothing without a fee", () => {
    expect(royaltyFromFee(1000, 100, 2)).toBe(20);
    expect(royaltyFromFee(155, 15, 2)).toBe(3.1);
    expect(royaltyFromFee(1000, 5, 2)).toBe(5);
    expect(royaltyFromFee(90, 0, 2)).toBe(0);
    expect(royaltyFromFee(1000, 100, 0)).toBe(0);
    expect(royaltyFromFee(1000, -5, 2)).toBe(0);
    expect(royaltyFromFee(-1000, 0, 2)).toBe(0);
    expect(royaltyFromFee(-1000, 100, 2)).toBe(0);
  });

  it("works the royalty out exactly, rounding a part cent down", () => {
    expect(royaltyFromFee(100, 10, 0.29)).toBe(0.29);
    expect(royaltyFromFee(101, 10, 2)).toBe(2.02);
    expect(royaltyFromFee(333, 33, 0.5)).toBe(1.66);
  });

  it("applies a rate finer than a hundredth of a percent rounded down, never above the stated rate", () => {
    // 7.555% of 1,000,000 is 75,550; the fee applies 7.55%.
    expect(saleFee(1_000_000, { ratePct: 7.555, threshold: 0 })).toBe(75_500);
    // 33.335% of 1,000 is 333.35; the refund applies 33.33%.
    expect(listingRefund(1000, 33.335)).toBe(333.3);
    // 2.005% of 1,000,000 is 20,050; the royalty applies 2%.
    expect(royaltyFromFee(1_000_000, 100_000, 2.005)).toBe(20_000);
    expect(saleFee(1_000_000, { ratePct: 7.559999, threshold: 0 })).toBe(75_500);
  });

  it("refunds half the listing fee in cents", () => {
    expect(listingRefund(5, 50)).toBe(2.5);
    expect(listingRefund(10, 50)).toBe(5);
    expect(listingRefund(0, 50)).toBe(0);
  });

  it("never refunds more than the fee or its share", () => {
    expect(listingRefund(5, 100)).toBe(5);
    expect(listingRefund(5, 150)).toBe(5);
    expect(listingRefund(5, -10)).toBe(0);
    expect(listingRefund(5, 33.33)).toBe(1.66);
    expect(listingRefund(7, 29)).toBe(2.03);
  });
});
