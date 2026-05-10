import { calculateNetworkDays, calculatePhaseBudget, validateFTE, calculateRevisedForecast, calculateRAGStatus, RAGStatus } from './computations';

describe('Computations Logic', () => {

  describe('NETWORKDAYS', () => {
    it('should calculate days without weekends', () => {
      // Monday to Friday
      const start = new Date('2026-05-04');
      const end = new Date('2026-05-08');
      expect(calculateNetworkDays(start, end)).toBe(5);
    });

    it('should exclude weekends', () => {
      // Friday to Monday (Fri, Sat, Sun, Mon) -> 2 working days
      const start = new Date('2026-05-08');
      const end = new Date('2026-05-11');
      expect(calculateNetworkDays(start, end)).toBe(2);
    });

    it('should exclude public holidays', () => {
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-10');
      // 01/05 is Friday (Holiday), 02-03 is Weekend, 04-08 is Mon-Fri, 09-10 is Weekend
      // Expected working days: 04, 05, 06, 07, 08 = 5 days.
      const holidays = [new Date('2026-05-01')];
      expect(calculateNetworkDays(start, end, holidays)).toBe(5);
    });

    it('should return 0 if start is after end', () => {
      const start = new Date('2026-05-10');
      const end = new Date('2026-05-01');
      expect(calculateNetworkDays(start, end)).toBe(0);
    });
  });

  describe('calculatePhaseBudget', () => {
    it('should sum monthly costs correctly', () => {
      const allocations = [
        { monthlyCost: 1000 },
        { monthlyCost: 500.5 },
        { monthlyCost: 200 }
      ];
      expect(calculatePhaseBudget(allocations)).toBe(1700.5);
    });

    it('should return 0 for empty allocations', () => {
      expect(calculatePhaseBudget([])).toBe(0);
    });
  });

  describe('validateFTE', () => {
    it('should validate correctly when total FTE <= 1.0', () => {
      const allocations = [
        { projectId: 1, week_start: '2026-05-04', fte: 0.5 },
        { projectId: 2, week_start: '2026-05-04', fte: 0.5 },
      ];
      const result = validateFTE(allocations, '2026-05-04');
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should return warnings when total FTE > 1.0', () => {
      const allocations = [
        { projectId: 1, week_start: '2026-05-04', fte: 0.8 },
        { projectId: 2, week_start: '2026-05-04', fte: 0.4 },
        { projectId: 1, week_start: '2026-06-01', fte: 1.0 }, // different week
      ];
      const result = validateFTE(allocations, '2026-05-04');
      expect(result.isValid).toBe(false);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings).toEqual([
        { projectId: 1, week_start: '2026-05-04', excess: 0.2 },
        { projectId: 2, week_start: '2026-05-04', excess: 0.2 },
      ]);
    });
  });

  describe('calculateRevisedForecast', () => {
    it('should calculate forecast correctly when hoursSpent is 0', () => {
      // timeBasedForecast = 1000 + (200 * 5) = 2000
      expect(calculateRevisedForecast(0, 1000, 200, 5, 50, 40)).toBe(2000);
    });

    it('should calculate forecast correctly when hoursSpent > 0', () => {
      // timeBasedForecast = 1000 + (200 * 5) = 2000
      // costBasedForecast = 1000 + (50 * 40) = 3000
      // average = 2500
      expect(calculateRevisedForecast(10, 1000, 200, 5, 50, 40)).toBe(2500);
    });
  });

  describe('calculateRAGStatus', () => {
    it('should return IN_LINEA if forecast <= baseline * 1.05', () => {
      expect(calculateRAGStatus(100, 100)).toBe(RAGStatus.IN_LINEA);
      expect(calculateRAGStatus(105, 100)).toBe(RAGStatus.IN_LINEA);
    });

    it('should return A_RISCHIO if forecast is between 1.05 and 1.15 of baseline', () => {
      expect(calculateRAGStatus(106, 100)).toBe(RAGStatus.A_RISCHIO);
      expect(calculateRAGStatus(115, 100)).toBe(RAGStatus.A_RISCHIO);
    });

    it('should return FUORI_BUDGET if forecast > baseline * 1.15', () => {
      expect(calculateRAGStatus(116, 100)).toBe(RAGStatus.FUORI_BUDGET);
      expect(calculateRAGStatus(150, 100)).toBe(RAGStatus.FUORI_BUDGET);
    });

    it('should handle zero baseline edge case', () => {
      expect(calculateRAGStatus(50, 0)).toBe(RAGStatus.FUORI_BUDGET);
      expect(calculateRAGStatus(0, 0)).toBe(RAGStatus.IN_LINEA);
    });
  });

});
