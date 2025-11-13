import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  describe('standard cases', () => {
    it('formats positive numbers correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats decimal numbers with correct precision', () => {
      expect(formatCurrency(10.5)).toBe('$10.50');
      expect(formatCurrency(10.99)).toBe('$10.99');
      expect(formatCurrency(10.1)).toBe('$10.10');
      expect(formatCurrency(10.001)).toBe('$10.00'); // Rounds to 2 decimals
      expect(formatCurrency(10.999)).toBe('$11.00'); // Rounds up
    });
  });

  describe('edge cases - null and undefined', () => {
    it('handles null values', () => {
      expect(formatCurrency(null)).toBe('$0.00');
    });

    it('handles undefined values', () => {
      expect(formatCurrency(undefined)).toBe('$0.00');
    });

    it('handles NaN values', () => {
      expect(formatCurrency(NaN)).toBe('$0.00');
    });
  });

  describe('negative numbers', () => {
    it('formats negative numbers correctly', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
      expect(formatCurrency(-1000)).toBe('-$1,000.00');
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });

    it('formats negative decimal numbers correctly', () => {
      expect(formatCurrency(-10.5)).toBe('-$10.50');
      expect(formatCurrency(-0.99)).toBe('-$0.99');
    });
  });

  describe('very large numbers', () => {
    it('formats large numbers with correct thousand separators', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(formatCurrency(999999.99)).toBe('$999,999.99');
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    });

    it('formats very large numbers', () => {
      expect(formatCurrency(1000000000)).toBe('$1,000,000,000.00');
      expect(formatCurrency(999999999999.99)).toBe('$999,999,999,999.99');
    });
  });

  describe('very small numbers', () => {
    it('formats small positive numbers correctly', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.99)).toBe('$0.99');
      expect(formatCurrency(0.001)).toBe('$0.00'); // Rounds to 2 decimals
    });

    it('formats small negative numbers correctly', () => {
      expect(formatCurrency(-0.01)).toBe('-$0.01');
      expect(formatCurrency(-0.99)).toBe('-$0.99');
    });
  });

  describe('decimal precision', () => {
    it('always shows exactly 2 decimal places', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(100.1)).toBe('$100.10');
      expect(formatCurrency(100.12)).toBe('$100.12');
    });

    it('rounds to 2 decimal places', () => {
      expect(formatCurrency(100.123)).toBe('$100.12');
      expect(formatCurrency(100.125)).toBe('$100.13'); // Banker's rounding
      expect(formatCurrency(100.126)).toBe('$100.13');
      expect(formatCurrency(100.995)).toBe('$101.00');
    });
  });

  describe('thousand separators', () => {
    it('adds comma separators at correct positions', () => {
      expect(formatCurrency(999)).toBe('$999.00');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(10000)).toBe('$10,000.00');
      expect(formatCurrency(100000)).toBe('$100,000.00');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('handles thousand separators with decimals', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(12345.67)).toBe('$12,345.67');
      expect(formatCurrency(123456.78)).toBe('$123,456.78');
    });
  });
});
