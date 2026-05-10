export function calculateNetworkDays(startDate: Date, endDate: Date, publicHolidays: Date[] = []): number {
  if (startDate > endDate) return 0;

  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const holidayTimes = new Set(publicHolidays.map(h => {
    const d = new Date(h);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }));

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      if (!holidayTimes.has(current.getTime())) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export function calculatePhaseBudget(allocations: { monthlyCost: number }[]): number {
  return allocations.reduce((sum, alloc) => sum + alloc.monthlyCost, 0);
}

export interface FTEAllocation {
  projectId: number;
  week_start: string; // Monday date YYYY-MM-DD
  fte: number;
}

export interface FTEValidationResult {
  isValid: boolean;
  warnings: {
    projectId: number;
    week_start: string;
    excess: number;
  }[];
}

export function validateFTE(
  allocations: FTEAllocation[],
  targetWeekStart: string
): FTEValidationResult {
  const targetAllocations = allocations.filter(a => a.week_start === targetWeekStart);
  const totalFTE = targetAllocations.reduce((sum, alloc) => sum + alloc.fte, 0);

  if (totalFTE > 1.0) {
    const excess = Number((totalFTE - 1.0).toFixed(2));
    const warnings = targetAllocations.map(a => ({
      projectId: a.projectId,
      week_start: targetWeekStart,
      excess,
    }));
    return { isValid: false, warnings };
  }

  return { isValid: true, warnings: [] };
}

export function calculateRevisedForecast(
  hoursSpent: number,
  costSpent: number,
  dailyBurnRate: number,
  daysRemaining: number,
  avgCostPerHour: number,
  hoursRemaining: number
): number {
  const timeBasedForecast = costSpent + (dailyBurnRate * daysRemaining);
  
  if (hoursSpent === 0) {
    return timeBasedForecast;
  } else {
    const costBasedForecast = costSpent + (avgCostPerHour * hoursRemaining);
    return (timeBasedForecast + costBasedForecast) / 2;
  }
}

export enum RAGStatus {
  IN_LINEA = 'IN_LINEA',
  A_RISCHIO = 'A_RISCHIO',
  FUORI_BUDGET = 'FUORI_BUDGET'
}

export function calculateRAGStatus(forecast: number, baseline: number): RAGStatus {
  if (baseline <= 0 && forecast > 0) return RAGStatus.FUORI_BUDGET;
  if (baseline <= 0) return RAGStatus.IN_LINEA;

  const ratio = forecast / baseline;
  
  if (ratio <= 1.05) {
    return RAGStatus.IN_LINEA;
  } else if (ratio <= 1.15) {
    return RAGStatus.A_RISCHIO;
  } else {
    return RAGStatus.FUORI_BUDGET;
  }
}
