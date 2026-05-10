/**
 * Lightweight NETWORKDAYS for real-time frontend calculations.
 * Excludes weekends only (no public holidays — backend handles those on save).
 */
export function networkDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Return array of month strings (YYYY-MM) that overlap with [startIso, endIso] */
export function monthsInRange(startIso: string, endIso: string): string[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= endMonth) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

/** Format YYYY-MM as "mmm-YY" (e.g. "mag-26") */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${names[parseInt(m, 10) - 1]}-${y.slice(2)}`;
}

/** Return array of week-start dates (Mondays, YYYY-MM-DD) that overlap with [startIso, endIso] */
export function weeksInRange(startIso: string, endIso: string): string[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  // Find the Monday on or before start
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const dow = cur.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  cur.setDate(cur.getDate() + offset);

  const result: string[] = [];
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

/** Format YYYY-MM-DD week-start as "DD mmm" (e.g. "05 gen") */
export function fmtWeek(weekStart: string): string {
  const [, m, d] = weekStart.split('-');
  const names = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${d} ${names[parseInt(m, 10) - 1]}`;
}
