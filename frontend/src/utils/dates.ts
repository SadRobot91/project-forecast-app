// Formattazione date condivisa (locale it-IT) — unica fonte per tutte le pagine.

/** dd/mm/yyyy — es. 12/06/2026 */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** dd/mm/yy — es. 12/06/26 */
export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** dd/mm — es. 12/06 (con fallback '—' per valori vuoti) */
export function fmtDayMonth(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

/** dd/mm/yy hh:mm — es. 12/06/26 14:30 */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
