export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function startOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function endOfMonth(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function startOfYear(year: number): string {
  return `${year}-01-01`;
}

export function endOfYear(year: number): string {
  return `${year}-12-31`;
}

export function getWeekDates(refDate: string): string[] {
  const d = new Date(refDate + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(dd.toISOString().split('T')[0]);
  }
  return dates;
}

export function isInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function daysSince(dateStr: string): number {
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getISOWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayNum + 1);
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getMonthIndex(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getMonth();
}

export function shortMonthName(monthIndex: number): string {
  return new Date(2024, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
}
