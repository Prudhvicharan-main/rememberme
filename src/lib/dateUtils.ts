import {
  format,
  parseISO,
  differenceInCalendarDays,
  isToday,
  isTomorrow,
  addMinutes,
  startOfDay,
} from 'date-fns';

/** yyyy-MM-dd for "today" in the device's local timezone. */
export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isoDateFromDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Combine an ISO date (yyyy-MM-dd) and optional "HH:mm" into a local Date. */
export function combineDateTime(isoDate: string, time: string | null): Date {
  const base = parseISO(isoDate);
  if (!time) return startOfDay(base);
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export function formatTime12h(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, 'h:mm a');
}

export function formatDateLong(isoDate: string): string {
  return format(parseISO(isoDate), 'MMMM d, yyyy');
}

export function formatDateShort(isoDate: string): string {
  return format(parseISO(isoDate), 'MMM d');
}

export function formatDayHeader(isoDate: string): string {
  const d = parseISO(isoDate);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, MMM d');
}

/** Human countdown string, e.g. "3 days remaining", "Today · 6:00 PM", "Tomorrow". */
export function countdownLabel(isoDate: string, time: string | null): string {
  const target = combineDateTime(isoDate, time);
  const days = differenceInCalendarDays(startOfDay(target), startOfDay(new Date()));

  if (days === 0) {
    return time ? `Today · ${formatTime12h(time)}` : 'Today';
  }
  if (days === 1) {
    return time ? `Tomorrow · ${formatTime12h(time)}` : 'Tomorrow';
  }
  if (days > 1) {
    return `${days} days remaining`;
  }
  if (days === -1) return 'Yesterday';
  return `${Math.abs(days)} days ago`;
}

export function reminderTriggerDate(
  isoDate: string,
  time: string | null,
  minutesBefore: number
): Date {
  const eventMoment = combineDateTime(isoDate, time ?? '09:00');
  return addMinutes(eventMoment, -minutesBefore);
}

export function isPastMoment(isoDate: string, time: string | null): boolean {
  return combineDateTime(isoDate, time).getTime() < Date.now();
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
