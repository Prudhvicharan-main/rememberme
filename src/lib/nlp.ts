import { addDays, format, nextDay, Day } from 'date-fns';
import { EventCategory, RecurrenceRule } from '@/types';

// ============================================================================
// Lightweight, fully on-device, rule-based natural-language parser.
// ----------------------------------------------------------------------------
// This is NOT a general LLM — it's a pattern matcher tuned to the phrasings
// in the RememberMe spec ("Meeting with professor tomorrow at 10 AM",
// "Dad's birthday September 12", "What important things do I have this
// week?", etc). It covers common relative dates, clock times, month-day
// dates, and category keywords, and always asks for confirmation before
// creating anything. For genuinely open-ended natural language, wiring this
// screen up to a real LLM API (with the user's own API key) would be a
// natural v2 upgrade — see the final summary for notes on that.
// ============================================================================

export interface ParsedEventDraft {
  title: string;
  category: EventCategory;
  date: string | null; // ISO yyyy-MM-dd
  time: string | null; // HH:mm, null = all-day
  isAllDay: boolean;
  recurrence: RecurrenceRule;
  personName?: string;
  needsDateConfirmation: boolean;
}

export type AssistantIntent =
  | { type: 'create_event'; draft: ParsedEventDraft }
  | { type: 'query_today' }
  | { type: 'query_upcoming'; rangeDays: number; label: string }
  | { type: 'query_birthdays' }
  | { type: 'query_anniversaries' }
  | { type: 'query_meetings' }
  | { type: 'query_meetings_tomorrow' }
  | { type: 'query_tasks' }
  | { type: 'greeting' }
  | { type: 'query_suggestions'; subject: string }
  | { type: 'unknown' };

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function classifyMessage(raw: string): AssistantIntent {
  const text = raw.trim().toLowerCase();

  if (/^(hi|hello|hey|hey there|good morning|good afternoon|good evening)[!. ]*$/.test(text)) {
    return { type: 'greeting' };
  }

  if (/meeting.*tomorrow|tomorrow.*meeting/.test(text)) {
    return { type: 'query_meetings_tomorrow' };
  }

  if (/(show|list|see|view).*(meeting|meetings)|what.*meetings|my meetings/.test(text)) {
    return { type: 'query_meetings' };
  }

  if (/what do i have today|what's today|what is today|show.*today/.test(text)) {
    return { type: 'query_today' };
  }

  if (/(show|list|see|view).*(task|tasks)|my tasks|what.*tasks/.test(text)) {
    return { type: 'query_tasks' };
  }

  if (/^(what|show me|whose|who('| i)s|what's)/.test(text)) {
    if (/birthday/.test(text)) return { type: 'query_birthdays' };
    if (/anniversary/.test(text)) return { type: 'query_anniversaries' };
    if (/(this week|next 7|coming up)/.test(text)) {
      return { type: 'query_upcoming', rangeDays: 7, label: 'this week' };
    }
    if (/next month|coming month/.test(text)) {
      return { type: 'query_upcoming', rangeDays: 30, label: 'next month' };
    }
    if (/what should i do/.test(text)) {
      const subject = text.replace(/what should i do (for|about)?/g, '').trim();
      return { type: 'query_suggestions', subject: subject || 'that' };
    }
    return { type: 'query_upcoming', rangeDays: 14, label: 'the next two weeks' };
  }

  // Otherwise, try to parse it as a new event.
  const draft = parseEventDraft(raw);
  return { type: 'create_event', draft };
}

export function parseEventDraft(raw: string): ParsedEventDraft {
  const lower = raw.toLowerCase();

  const time = extractTime(lower);
  const { date, matched: dateMatched } = extractDate(lower);
  const category = inferCategory(lower);
  const personName = extractPersonName(raw);
  const isAllDay = time === null && (category === 'birthday' || category === 'anniversary' || !hasTimeIndicator(lower));

  const recurrence: RecurrenceRule =
    category === 'birthday' || category === 'anniversary' || /every year|yearly|annual/.test(lower)
      ? { frequency: 'yearly' }
      : /every week|weekly/.test(lower)
      ? { frequency: 'weekly' }
      : { frequency: 'none' };

  const title = buildTitle(raw, category, personName);

  return {
    title,
    category,
    date,
    time: isAllDay ? null : time,
    isAllDay,
    recurrence,
    personName,
    needsDateConfirmation: !dateMatched,
  };
}

function hasTimeIndicator(text: string): boolean {
  return /\d{1,2}(:\d{2})?\s*(am|pm)|\bat\s+\d{1,2}/.test(text);
}

function extractTime(text: string): string | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const mer = m[3];
    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const m24 = text.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  if (m24) {
    return `${m24[1].padStart(2, '0')}:${m24[2]}`;
  }
  return null;
}

function extractDate(text: string): { date: string | null; matched: boolean } {
  const today = new Date();

  if (/\btoday\b/.test(text)) return { date: format(today, 'yyyy-MM-dd'), matched: true };
  if (/\btomorrow\b/.test(text)) return { date: format(addDays(today, 1), 'yyyy-MM-dd'), matched: true };

  const inDays = text.match(/\bin (\d+) days?\b/);
  if (inDays) return { date: format(addDays(today, parseInt(inDays[1], 10)), 'yyyy-MM-dd'), matched: true };

  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b(this |next )?${WEEKDAYS[i]}\\b`).test(text)) {
      const next = nextDay(today, i as Day);
      return { date: format(next, 'yyyy-MM-dd'), matched: true };
    }
  }

  // Numeric dates such as "19/8/26" or "19-08-2026".
  const numeric = text.match(/\b(\d{1,2})[\\/.-](\d{1,2})(?:[\\/.-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
      return { date: format(candidate, 'yyyy-MM-dd'), matched: true };
    }
  }

  // "September 12", "sep 12", "12 september"
  for (let i = 0; i < MONTHS.length; i++) {
    const month = MONTHS[i];
    const abbrev = month.slice(0, 3);
    const re1 = new RegExp(`\\b(${month}|${abbrev})\\.?\\s+(\\d{1,2})(st|nd|rd|th)?\\b`);
    const re2 = new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)?\\s+(${month}|${abbrev})\\b`);
    const m1 = text.match(re1);
    const m2 = text.match(re2);
    const day = m1 ? parseInt(m1[2], 10) : m2 ? parseInt(m2[1], 10) : null;
    if (day) {
      let year = today.getFullYear();
      const candidate = new Date(year, i, day);
      if (candidate.getTime() < today.getTime() - 86400000) year += 1; // roll to next year if already passed
      return { date: format(new Date(year, i, day), 'yyyy-MM-dd'), matched: true };
    }
  }

  return { date: null, matched: false };
}

function inferCategory(text: string): EventCategory {
  if (/birthday/.test(text)) return 'birthday';
  if (/anniversary/.test(text)) return 'anniversary';
  if (/wedding/.test(text)) return 'wedding';
  if (/\bmeeting\b|meet with|catch up with/.test(text)) return 'meeting';
  if (/exam|test\b/.test(text)) return 'exam';
  if (/assignment|submit|deadline|homework|project due/.test(text)) return 'task';
  if (/payment|pay\b|bill\b|invoice/.test(text)) return 'payment';
  if (/appointment|doctor|dentist|clinic/.test(text)) return 'appointment';
  if (/college|class\b|lecture|professor/.test(text)) return 'college';
  if (/\bcall\b|\bremind me to\b|\btask\b/.test(text)) return 'task';
  return 'event';
}

function extractPersonName(raw: string): string | undefined {
  const possessive = raw.match(/\b([A-Z][a-zA-Z]+)'s\b/);
  if (possessive) return possessive[1];
  const withMatch = raw.match(/\bwith\s+([A-Z][a-zA-Z]+)\b/);
  if (withMatch) return withMatch[1];
  const callMatch = raw.match(/\bcall\s+([A-Z][a-zA-Z]+|mom|dad|mum)\b/i);
  if (callMatch) return capitalize(callMatch[1]);
  return undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildTitle(raw: string, category: EventCategory, personName?: string): string {
  if (category === 'birthday' && personName) return `${personName}'s Birthday`;
  if (category === 'anniversary' && personName) return `${personName}'s Anniversary`;

  // Strip common leading command phrases for a cleaner title.
  let t = raw
    .replace(/^remind me (about|to)\s*/i, '')
    .replace(/^i have (a|an)\s*/i, '')
    .trim();

  // Trim trailing time/date phrases for a shorter title where possible.
  t = t
    .replace(/\b(today|tomorrow)\b/gi, '')
    .replace(/\b(this|next)\s+\w+day\b/gi, '')
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!t) t = raw.trim();
  return capitalize(t);
}
