import { addDays, startOfDay, endOfDay } from 'date-fns';
import { RememberEvent, EventOccurrence } from '@/types';
import { getOccurrencesInRange } from './recurrence';

export function occurrencesForRange(
  events: Record<string, RememberEvent>,
  start: Date,
  end: Date
): EventOccurrence[] {
  const all: EventOccurrence[] = [];
  for (const event of Object.values(events)) {
    all.push(...getOccurrencesInRange(event, start, end));
  }
  all.sort((a, b) => {
    const dateCmp = a.occurrenceDate.localeCompare(b.occurrenceDate);
    if (dateCmp !== 0) return dateCmp;
    const at = a.event.isAllDay ? '00:00' : a.event.time ?? '00:00';
    const bt = b.event.isAllDay ? '00:00' : b.event.time ?? '00:00';
    if (a.event.isAllDay !== b.event.isAllDay) return a.event.isAllDay ? -1 : 1;
    return at.localeCompare(bt);
  });
  return all;
}

export function todaysOccurrences(events: Record<string, RememberEvent>): {
  timed: EventOccurrence[];
  allDay: EventOccurrence[];
} {
  const now = new Date();
  const list = occurrencesForRange(events, startOfDay(now), endOfDay(now));
  return {
    timed: list.filter((o) => !o.event.isAllDay),
    allDay: list.filter((o) => o.event.isAllDay),
  };
}

export function upcomingOccurrences(
  events: Record<string, RememberEvent>,
  days: number,
  excludeToday = true
): EventOccurrence[] {
  const now = new Date();
  const start = excludeToday ? startOfDay(addDays(now, 1)) : startOfDay(now);
  const end = endOfDay(addDays(now, days));
  return occurrencesForRange(events, start, end).filter((o) => !o.isCompleted);
}

export function taskOccurrences(
  events: Record<string, RememberEvent>,
  days = 365
): EventOccurrence[] {
  const now = new Date();
  const start = startOfDay(addDays(now, -30)); // include recently-overdue
  const end = endOfDay(addDays(now, days));
  return occurrencesForRange(events, start, end).filter((o) =>
    ['task', 'work', 'college', 'exam', 'payment', 'appointment'].includes(o.event.category)
  );
}

export function overdueOccurrences(events: Record<string, RememberEvent>): EventOccurrence[] {
  const now = new Date();
  const start = startOfDay(addDays(now, -365));
  const end = startOfDay(now);
  return occurrencesForRange(events, start, end).filter((o) => !o.isCompleted);
}

export function upcomingBirthdaysAndAnniversaries(
  events: Record<string, RememberEvent>,
  days = 60
): EventOccurrence[] {
  const now = new Date();
  const list = occurrencesForRange(events, startOfDay(now), endOfDay(addDays(now, days)));
  return list.filter((o) => o.event.category === 'birthday' || o.event.category === 'anniversary');
}
