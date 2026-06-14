import type { TaskStatus } from '../../types';

export const WEEK_PX = 60;
export const ROW_PX  = 48;
export const LABEL_W = 228;
export const TODAY   = new Date().toISOString().split('T')[0];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Non iniziato',
  in_progress: 'In corso',
  completed:   'Completato',
};

export function dayDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function toPx(projectStart: string, date: string): number {
  return Math.max(0, (dayDiff(projectStart, date) / 7) * WEEK_PX);
}

export function spanPx(start: string, end: string): number {
  return Math.max((Math.max(1, dayDiff(start, end)) / 7) * WEEK_PX, 6);
}

export function getWeeks(start: string, end: string): string[] {
  const weeks: string[] = [];
  const d = new Date(start);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const endD = new Date(end);
  while (d <= endD) {
    weeks.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

export function statusBg(status: string): string {
  if (status === 'completed') return 'bg-rag-green';
  if (status === 'in_progress') return 'bg-accent';
  return 'bg-text-dim/30';
}
