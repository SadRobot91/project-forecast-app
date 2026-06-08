const formatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return formatter.format(value);
}
