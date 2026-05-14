import { describe, it, expect } from 'vitest';
import { networkDays, weeksInRange } from './networkDays';

describe('Frontend NetworkDays Utility', () => {
  describe('networkDays', () => {
    it('should calculate working days correctly (excluding weekends)', () => {
      // 2026-05-04 (Mon) to 2026-05-08 (Fri) = 5 days
      expect(networkDays('2026-05-04', '2026-05-08')).toBe(5);
    });

    it('should return 0 if start is after end', () => {
      expect(networkDays('2026-05-10', '2026-05-01')).toBe(0);
    });

    it('should handle same day (weekday)', () => {
      expect(networkDays('2026-05-04', '2026-05-04')).toBe(1);
    });

    it('should handle same day (weekend)', () => {
      expect(networkDays('2026-05-03', '2026-05-03')).toBe(0);
    });
  });

  describe('weeksInRange', () => {
    it('should return correct Mondays for a range', () => {
      // 2026-05-04 is a Monday
      // 2026-05-18 is a Monday
      const weeks = weeksInRange('2026-05-04', '2026-05-20');
      expect(weeks).toEqual(['2026-05-04', '2026-05-11', '2026-05-18']);
    });
  });
});
