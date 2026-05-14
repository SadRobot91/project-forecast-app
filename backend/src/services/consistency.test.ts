import { calculateRAGStatus, RAGStatus, calculateNetworkDays } from './computations';

describe('Calculation Consistency & Edge Cases', () => {
  
  describe('RAG Status Floating Point Safety', () => {
    it('should handle floating point precision correctly near 1.05', () => {
      // 105.00000000000001 / 100 is slightly > 1.05
      expect(calculateRAGStatus(105.00000000000001, 100)).toBe(RAGStatus.IN_LINEA);
      // 105.1 / 100 is clearly > 1.05
      expect(calculateRAGStatus(105.1, 100)).toBe(RAGStatus.A_RISCHIO);
    });

    it('should handle floating point precision correctly near 1.15', () => {
      expect(calculateRAGStatus(115.00000000000001, 100)).toBe(RAGStatus.A_RISCHIO);
      expect(calculateRAGStatus(115.1, 100)).toBe(RAGStatus.FUORI_BUDGET);
    });
  });

  describe('NETWORKDAYS vs Frontend Inconsistency', () => {
    it('should produce the same result as frontend for weekday ranges without holidays', () => {
      const start = new Date('2026-05-04'); // Monday
      const end = new Date('2026-05-08');   // Friday
      // Backend:
      const backendResult = calculateNetworkDays(start, end, []);
      // Manual replication of frontend logic (which only excludes weekends)
      let frontendReplication = 0;
      let cur = new Date(start);
      while(cur <= end) {
        if (cur.getDay() !== 0 && cur.getDay() !== 6) frontendReplication++;
        cur.setDate(cur.getDate() + 1);
      }
      expect(backendResult).toBe(frontendReplication);
    });

    it('WARNING: Frontend and Backend DIVERGE when holidays are present', () => {
      const holiday = new Date('2026-05-01'); // Friday
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-01');
      
      const backendResult = calculateNetworkDays(start, end, [holiday]);
      expect(backendResult).toBe(0);

      // Frontend ignores holidays
      let frontendReplication = 0;
      if (start.getDay() !== 0 && start.getDay() !== 6) frontendReplication++;
      expect(frontendReplication).toBe(1);
      
      // This confirms the divergence.
      expect(backendResult).not.toBe(frontendReplication);
    });
  });
});
