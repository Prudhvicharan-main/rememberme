import { addDays, addMonths, addYears, format, parseISO, isBefore, isAfter } from 'date-fns';
import { RememberEvent, EventOccurrence } from '@/types';

/**
 * THE FIX FOR RECURRING-EVENT DUPLICATION
 * ----------------------------------------------------------------------
 * A recurring event (e.g. a yearly birthday) is stored as exactly ONE
 * RememberEvent record with a `recurrence` rule. We never write a second
 * record per year/week/month. Instead, every screen that needs to display
 * occurrences within a date range calls `getOccurrencesInRange`, which is a
 * pure function that derives occurrence dates mathematically from the rule.
 * Because occurrences are computed, not stored, there is no data-flow path
 * that can accidentally persist the same occurrence twice.
 */

const MAX_OCCURRENCES_PER_EVENT = 400; // hard safety cap against infinite loops

export function getOccurrencesInRange(
  event: RememberEvent,
  rangeStart: Date,
  rangeEnd: Date
): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];
  const anchor = parseISO(event.date);
  const seriesEnd = event.recurrence.endDate ? parseISO(event.recurrence.endDate) : null;

  if (event.recurrence.frequency === 'none') {
    if (!isBefore(anchor, rangeStart) && !isAfter(anchor, rangeEnd)) {
      occurrences.push(toOccurrence(event, anchor));
    } else if (isSameOrAfterDay(anchor, rangeStart) && isSameOrBeforeDay(anchor, rangeEnd)) {
      occurrences.push(toOccurrence(event, anchor));
    }
    return dedupeByDate(occurrences);
  }

  let cursor = anchor;
  let count = 0;

  // Fast-forward cursor close to rangeStart for long-lived series so we don't
  // iterate thousands of steps for an old event.
  cursor = fastForward(cursor, rangeStart, event.recurrence.frequency);

  while (count < MAX_OCCURRENCES_PER_EVENT) {
    if (seriesEnd && isAfter(cursor, seriesEnd)) break;
    if (isAfter(cursor, rangeEnd)) break;

    if (event.recurrence.frequency === 'weekly' && event.recurrence.byDay?.length) {
      // For weekly-with-specific-days, check each day in the week window.
      for (const weekday of event.recurrence.byDay) {
        const candidate = alignToWeekday(cursor, weekday);
        if (
          isSameOrAfterDay(candidate, rangeStart) &&
          isSameOrBeforeDay(candidate, rangeEnd) &&
          !isBefore(candidate, anchor)
        ) {
          occurrences.push(toOccurrence(event, candidate));
        }
      }
      cursor = addDays(cursor, 7);
    } else {
      if (isSameOrAfterDay(cursor, rangeStart) && isSameOrBeforeDay(cursor, rangeEnd)) {
        occurrences.push(toOccurrence(event, cursor));
      }
      cursor = advance(cursor, event.recurrence.frequency);
    }
    count++;
  }

  return dedupeByDate(occurrences);
}

/** Returns the single next upcoming occurrence on/after `from`, or null. */
export function getNextOccurrence(event: RememberEvent, from: Date): EventOccurrence | null {
  const rangeEnd = addYears(from, 2);
  const list = getOccurrencesInRange(event, from, rangeEnd);
  return list.length > 0 ? list[0] : null;
}

function advance(d: Date, freq: 'daily' | 'weekly' | 'monthly' | 'yearly'): Date {
  switch (freq) {
    case 'daily':
      return addDays(d, 1);
    case 'weekly':
      return addDays(d, 7);
    case 'monthly':
      return addMonths(d, 1);
    case 'yearly':
      return addYears(d, 1);
  }
}

function fastForward(anchor: Date, rangeStart: Date, freq: RememberEvent['recurrence']['frequency']): Date {
  if (freq === 'none' || !isBefore(anchor, rangeStart)) return anchor;
  let cursor = anchor;
  let guard = 0;
  while (isBefore(cursor, rangeStart) && guard < MAX_OCCURRENCES_PER_EVENT) {
    const next = freq === 'weekly' ? addDays(cursor, 7) : advance(cursor, freq as any);
    cursor = next;
    guard++;
  }
  // Step back one so the main loop's range checks still catch a same-day match.
  return freq === 'weekly' ? addDays(cursor, -7) : stepBack(cursor, freq);
}

function stepBack(d: Date, freq: RememberEvent['recurrence']['frequency']): Date {
  switch (freq) {
    case 'daily':
      return addDays(d, -1);
    case 'monthly':
      return addMonths(d, -1);
    case 'yearly':
      return addYears(d, -1);
    default:
      return d;
  }
}

function alignToWeekday(d: Date, weekday: number): Date {
  const currentDay = d.getDay();
  const diff = weekday - currentDay;
  return addDays(d, diff);
}

function toOccurrence(event: RememberEvent, date: Date): EventOccurrence {
  const occurrenceDate = format(date, 'yyyy-MM-dd');
  const isCompleted =
    event.recurrence.frequency === 'none'
      ? event.completed
      : !!event.completedOccurrences?.includes(occurrenceDate);
  return { event, occurrenceDate, isCompleted };
}

function isSameOrAfterDay(d: Date, ref: Date): boolean {
  return !isBefore(stripTime(d), stripTime(ref));
}
function isSameOrBeforeDay(d: Date, ref: Date): boolean {
  return !isAfter(stripTime(d), stripTime(ref));
}
function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dedupeByDate(list: EventOccurrence[]): EventOccurrence[] {
  const seen = new Set<string>();
  const out: EventOccurrence[] = [];
  for (const occ of list) {
    const key = `${occ.event.id}:${occ.occurrenceDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(occ);
  }
  out.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
  return out;
}
