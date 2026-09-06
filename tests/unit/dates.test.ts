import { addDays, formatDateRange, formatDay, formatWeekRange, fromISODate, startOfWeek, toISODate, weekDays } from '@/lib/dates';

describe('week math', () => {
  const fri = new Date(2026, 8, 4); // Friday Sep 4 2026
  it('finds the start of a Sunday week', () => {
    expect(toISODate(startOfWeek(fri, 0))).toBe('2026-08-30');
  });
  it('finds the start of a Monday week', () => {
    expect(toISODate(startOfWeek(fri, 1))).toBe('2026-08-31');
  });
  it('a week has seven consecutive days', () => {
    const days = weekDays(startOfWeek(fri, 0));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-08-30');
    expect(days[6]).toBe('2026-09-05');
  });
  it('round-trips ISO dates in local time', () => {
    expect(toISODate(fromISODate('2026-12-31'))).toBe('2026-12-31');
    expect(toISODate(addDays(fromISODate('2026-12-31'), 1))).toBe('2027-01-01');
  });
});

describe('labels', () => {
  it('formats ranges within and across months', () => {
    expect(formatWeekRange(new Date(2026, 8, 6))).toBe('Sep 6 – 12');
    expect(formatWeekRange(new Date(2026, 8, 27))).toBe('Sep 27 – Oct 3');
    expect(formatDateRange(new Date(2026, 7, 30), new Date(2026, 8, 5))).toBe('Aug 30 – Sep 5');
  });
  it('formats a day', () => {
    expect(formatDay('2026-09-04')).toEqual({ weekday: 'Fri', date: 'Sep 4' });
  });
});
