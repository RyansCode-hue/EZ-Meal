// Calendar-date helpers. Plan entries are keyed by local calendar date as
// YYYY-MM-DD, never by timestamp, so "Tuesday's dinner" is the same on both phones.

export type ISODate = string;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** Midnight of the week containing `d`, for a week starting on `weekStartDay` (0 = Sunday). */
export function startOfWeek(d: Date, weekStartDay: number): Date {
  const diff = (d.getDay() - weekStartDay + 7) % 7;
  const r = addDays(d, -diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function weekDays(start: Date): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)));
}

export function formatDay(iso: ISODate): { weekday: string; date: string } {
  const d = fromISODate(iso);
  return { weekday: WEEKDAY_SHORT[d.getDay()], date: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` };
}

export function formatDayLong(iso: ISODate): string {
  const d = fromISODate(iso);
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Sep 7 – 13" or "Sep 28 – Oct 4". */
export function formatDateRange(start: Date, end: Date): string {
  const a = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  const b = start.getMonth() === end.getMonth() ? String(end.getDate()) : `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `${a} – ${b}`;
}

export function formatWeekRange(start: Date): string {
  return formatDateRange(start, addDays(start, 6));
}
