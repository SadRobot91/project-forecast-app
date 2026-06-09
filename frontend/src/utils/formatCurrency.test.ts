import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('returns em-dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats a positive integer with GBP symbol', () => {
    const result = formatCurrency(1000);
    expect(result).toMatch(/£|GBP/);
    expect(result).toContain('1');
  });

  it('formats without decimal digits', () => {
    const result = formatCurrency(1500);
    expect(result).not.toContain('.');
    expect(result).not.toContain(',00');
  });

  it('formats negative numbers', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500');
    expect(result).toContain('-');
  });

  it('formats large numbers', () => {
    const result = formatCurrency(100000);
    expect(result).toContain('100');
  });
});
