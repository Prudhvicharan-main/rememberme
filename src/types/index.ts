// ============================================================================
// RememberMe — Core data model
// ----------------------------------------------------------------------------
// Every event has exactly ONE canonical record, identified by `id`.
// Dashboard / Calendar / Tasks / Upcoming / Notifications / Search / Assistant
// all read from the same underlying store — nothing is ever copied into a
// separate "list" record, which is what causes duplicate-looking entries.
// Recurring events are stored as ONE rule (see RecurrenceRule) and their
// future occurrences are computed on the fly (src/lib/recurrence.ts) —
// they are never materialized into separate stored records.
// ============================================================================

export type EventCategory =
  | 'birthday'
  | 'anniversary'
  | 'wedding'
  | 'meeting'
  | 'task'
  | 'college'
  | 'work'
  | 'payment'
  | 'appointment'
  | 'exam'
  | 'event'
  | 'important'
  | 'custom';

export const EVENT_CATEGORIES: { key: EventCategory; label: string; emoji: string }[] = [
  { key: 'birthday', label: 'Birthday', emoji: '🎂' },
  { key: 'anniversary', label: 'Anniversary', emoji: '💍' },
  { key: 'wedding', label: 'Wedding', emoji: '💒' },
  { key: 'meeting', label: 'Meeting', emoji: '📅' },
  { key: 'task', label: 'Task', emoji: '📝' },
  { key: 'college', label: 'College', emoji: '🎓' },
  { key: 'work', label: 'Work', emoji: '💼' },
  { key: 'payment', label: 'Payment', emoji: '💰' },
  { key: 'appointment', label: 'Appointment', emoji: '🏥' },
  { key: 'exam', label: 'Exam', emoji: '📚' },
  { key: 'event', label: 'Event', emoji: '🎉' },
  { key: 'important', label: 'Important', emoji: '⭐' },
  { key: 'custom', label: 'Custom', emoji: '➕' },
];

export type Priority = 'normal' | 'important' | 'very_important';

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** For weekly: 0=Sun..6=Sat. Only used when frequency === 'weekly'. */
  byDay?: number[];
  /** Optional ISO date (yyyy-MM-dd) after which the series stops. */
  endDate?: string | null;
}

export type ReminderOffsetKey =
  | 'at_time'
  | '10m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '1d'
  | '2d'
  | '3d'
  | '7d'
  | '14d'
  | '30d'
  | 'custom';

export const REMINDER_OFFSET_MINUTES: Record<Exclude<ReminderOffsetKey, 'custom'>, number> = {
  at_time: 0,
  '10m': 10,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '1d': 60 * 24,
  '2d': 60 * 24 * 2,
  '3d': 60 * 24 * 3,
  '7d': 60 * 24 * 7,
  '14d': 60 * 24 * 14,
  '30d': 60 * 24 * 30,
};

export const REMINDER_OFFSET_LABELS: Record<ReminderOffsetKey, string> = {
  at_time: 'At time of event',
  '10m': '10 minutes before',
  '15m': '15 minutes before',
  '30m': '30 minutes before',
  '1h': '1 hour before',
  '2h': '2 hours before',
  '1d': '1 day before',
  '2d': '2 days before',
  '3d': '3 days before',
  '7d': '7 days before',
  '14d': '14 days before',
  '30d': '30 days before',
  custom: 'Custom',
};

export interface Reminder {
  id: string;
  offset: ReminderOffsetKey;
  /** Only set when offset === 'custom'. Minutes before the event. */
  customMinutes?: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface RememberEvent {
  id: string;
  title: string;
  category: EventCategory;
  /** Anchor date, ISO yyyy-MM-dd. For recurring events this is the first/original occurrence. */
  date: string;
  /** "HH:mm" 24h, or null for all-day events. */
  time: string | null;
  /** Optional end time "HH:mm", used for meeting duration. */
  endTime?: string | null;
  isAllDay: boolean;
  timezone: string;
  description?: string;
  personId?: string | null;
  location?: string;
  priority: Priority;
  recurrence: RecurrenceRule;
  reminders: Reminder[];
  checklist?: ChecklistItem[];
  completed: boolean;
  completedAt?: string | null;
  /** ISO dates (yyyy-MM-dd) of individual recurring occurrences marked complete. */
  completedOccurrences?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  relationship?: string;
  phoneNumber?: string;
  /** MM-dd */
  birthday?: string | null;
  /** MM-dd */
  anniversary?: string | null;
  favoriteThings?: string;
  notes?: string;
  birthdayEventId?: string | null;
  anniversaryEventId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemePreference;
  notificationsEnabled: boolean;
  morningBriefingEnabled: boolean;
  defaultReminders: Partial<Record<EventCategory, ReminderOffsetKey[]>>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  notificationsEnabled: true,
  morningBriefingEnabled: true,
  defaultReminders: {
    birthday: ['30d', '7d', '3d', '1d', 'at_time'],
    anniversary: ['7d', '1d', 'at_time'],
    meeting: ['30m'],
    task: ['1h'],
    appointment: ['1d', '1h'],
    exam: ['7d', '1d'],
    payment: ['3d', '1d'],
  },
};

/** A concrete, computed occurrence of an event on a specific calendar date. */
export interface EventOccurrence {
  event: RememberEvent;
  /** ISO yyyy-MM-dd for this specific occurrence. */
  occurrenceDate: string;
  isCompleted: boolean;
}

/** Record of a notification that has been scheduled on-device for a specific event occurrence + reminder. */
export interface ScheduledNotificationRecord {
  /** Composite key: `${eventId}:${occurrenceDate}:${reminderId}` */
  key: string;
  eventId: string;
  reminderId: string;
  occurrenceDate: string;
  notificationId: string;
  triggerTimeIso: string;
}
