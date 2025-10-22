/**
 * Tests for format-utils.ts - Currency formatting with custom currency support
 */

import {
  formatCurrency,
  formatExactCurrency,
  safeFormatCurrency,
  getAvailableCurrencies,
  getCurrencyInfo,
  isValidCurrency
} from '../format-utils';

describe('Currency Formatting', () => {
  describe('ISO Currency Support', () => {
    test('formats USD correctly', () => {
      expect(formatCurrency(1234, 'USD')).toBe('$1.2K');
      expect(formatCurrency(1234567, 'USD')).toBe('$1.2M');
      expect(formatCurrency(1234567890, 'USD')).toBe('$1.2B');
    });

    test('formats EUR correctly', () => {
      expect(formatCurrency(1234, 'EUR')).toBe('€1.2K');
      expect(formatCurrency(1234567, 'EUR')).toBe('€1.2M');
    });
  });

  describe('Custom Currency Support', () => {
    test('formats Taler correctly', () => {
      expect(formatCurrency(1234, 'Taler')).toBe('₮1.2K');
      expect(formatCurrency(1234567, 'Taler')).toBe('₮1.2M');
      expect(formatCurrency(1234567890, 'Taler')).toBe('₮1.2B');
    });

    test('formats Crown correctly', () => {
      expect(formatCurrency(1234, 'Crown')).toBe('©1.2K');
      expect(formatCurrency(1234567, 'Crown')).toBe('©1.2M');
    });

    test('formats unknown custom currency with fallback', () => {
      expect(formatCurrency(1234, 'CustomCoin')).toBe('CustomCoin 1,234');
      expect(formatCurrency(1234567, 'CustomCoin')).toBe('CustomCoin 1,234,567');
    });
  });

  describe('Safe Currency Formatting', () => {
    test('handles invalid currency with fallback', () => {
      expect(safeFormatCurrency(1234, 'InvalidCurrency', false, 'USD')).toBe('$1.2K');
    });

    test('handles valid currency normally', () => {
      expect(safeFormatCurrency(1234, 'USD', false, 'EUR')).toBe('$1.2K');
    });
  });

  describe('Currency Validation', () => {
    test('validates ISO currencies', () => {
      expect(isValidCurrency('USD')).toBe(true);
      expect(isValidCurrency('EUR')).toBe(true);
      expect(isValidCurrency('GBP')).toBe(true);
    });

    test('validates custom currencies', () => {
      expect(isValidCurrency('Taler')).toBe(true);
      expect(isValidCurrency('Crown')).toBe(true);
      expect(isValidCurrency('Mark')).toBe(true);
    });

    test('rejects invalid currencies', () => {
      expect(isValidCurrency('INVALID')).toBe(false);
      expect(isValidCurrency('')).toBe(false);
    });
  });

  describe('Currency Information', () => {
    test('gets ISO currency info', () => {
      const info = getCurrencyInfo('USD');
      expect(info.isISO).toBe(true);
    });

    test('gets custom currency info', () => {
      const info = getCurrencyInfo('Taler');
      expect(info.isISO).toBe(false);
      expect(info.symbol).toBe('₮');
      expect(info.name).toBe('Taler');
    });

    test('handles unknown currency', () => {
      const info = getCurrencyInfo('Unknown');
      expect(info.isISO).toBe(false);
      expect(info.symbol).toBeUndefined();
      expect(info.name).toBeUndefined();
    });
  });

  describe('Available Currencies', () => {
    test('includes ISO currencies', () => {
      const currencies = getAvailableCurrencies();
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
    });

    test('includes custom currencies', () => {
      const currencies = getAvailableCurrencies();
      expect(currencies).toContain('Taler');
      expect(currencies).toContain('Crown');
      expect(currencies).toContain('Mark');
    });
  });

  describe('Exact Currency Formatting', () => {
    test('formats exact amounts with ISO currencies', () => {
      expect(formatExactCurrency(1234567, 'USD')).toBe('$1,234,567');
    });

    test('formats exact amounts with custom currencies', () => {
      expect(formatExactCurrency(1234567, 'Taler')).toBe('₮1,234,567');
    });

    test('formats exact amounts with unknown currencies', () => {
      expect(formatExactCurrency(1234567, 'CustomCoin')).toBe('CustomCoin 1,234,567');
    });
  });

  describe('Edge Cases', () => {
    test('handles zero amounts', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0');
      expect(formatCurrency(0, 'Taler')).toBe('₮0');
    });

    test('handles negative amounts', () => {
      expect(formatCurrency(-1234, 'USD')).toBe('-$1.2K');
      expect(formatCurrency(-1234, 'Taler')).toBe('₮-1.2K');
    });

    test('handles very small amounts', () => {
      expect(formatCurrency(0.5, 'USD')).toBe('$1');
      expect(formatCurrency(0.5, 'Taler')).toBe('₮1');
    });

    test('handles very large amounts', () => {
      expect(formatCurrency(1e15, 'USD')).toBe('$1,000.0T');
      expect(formatCurrency(1e15, 'Taler')).toBe('₮1,000.0T');
    });
  });
});
