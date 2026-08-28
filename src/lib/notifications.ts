import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays } from 'date-fns';
import {
  RememberEvent,
  ScheduledNotificationRecord,
  REMINDER_OFFSET_MINUTES,
  RecurrenceFrequency,
} from '@/types';
import { getOccurrencesInRange } from './recurrence';
import { reminderTriggerDate, formatTime12h, formatDateShort } from './dateUtils';
import { readJson, writeJson, StorageKeys } from './storage';
import { EVENT_CATEGORIES } from '@/types';

// ----------------------------------------------------------------------------
// Handler: how a notification behaves when it arrives while the app is open.
// ----------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'default';

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8B5CF6',
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestPermissions(): Promise<PermissionState> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (requested.status === 'granted') return 'granted';
  if (requested.status === 'denied') return 'denied';
  return 'undetermined';
}

// ----------------------------------------------------------------------------
// Local persistent map of everything we've scheduled, keyed by
// `${eventId}:${occurrenceDate}:${reminderId}`. This is the single source of
// truth that lets us (a) never schedule the same reminder twice, and
// (b) always find + cancel the right native notification when an event
// changes or is deleted — so nothing is ever left orphaned.
// ----------------------------------------------------------------------------
type ScheduledMap = Record<string, ScheduledNotificationRecord>;

async function getScheduledMap(): Promise<ScheduledMap> {
  return readJson<ScheduledMap>(StorageKeys.scheduledNotifications, {});
}

async function persistScheduledMap(map: ScheduledMap): Promise<void> {
  await writeJson(StorageKeys.scheduledNotifications, map);
}

export async function getAllScheduledRecords(): Promise<ScheduledNotificationRecord[]> {
  const map = await getScheduledMap();
  return Object.values(map).sort((a, b) => a.triggerTimeIso.localeCompare(b.triggerTimeIso));
}

function lookaheadDaysFor(freq: RecurrenceFrequency): number {
  switch (freq) {
    case 'daily':
      return 14;
    case 'weekly':
      return 56;
    case 'monthly':
      return 180;
    case 'yearly':
      return 400;
    case 'none':
    default:
      return 730;
  }
}

function categoryEmoji(category: RememberEvent['category']): string {
  return EVENT_CATEGORIES.find((c) => c.key === category)?.emoji ?? '⭐';
}

function buildNotificationContent(
  event: RememberEvent,
  occurrenceDate: string
): Notifications.NotificationContentInput {
  const emoji = categoryEmoji(event.category);
  const whenLabel = event.isAllDay
    ? formatDateShort(occurrenceDate)
    : `${formatDateShort(occurrenceDate)} · ${formatTime12h(event.time)}`;
  return {
    title: `${emoji} ${event.title}`,
    body: whenLabel,
    data: { eventId: event.id, occurrenceDate },
    sound: true,
  };
}

/**
 * Diff-based sync for ONE event: schedules whatever reminders are missing
 * within the lookahead window, and cancels+removes any previously scheduled
 * notification for this event that is no longer valid (reminder removed,
 * occurrence completed, event rescheduled, event deleted from window, etc).
 * Safe to call repeatedly — calling it twice in a row schedules nothing new.
 */
export async function syncEventNotifications(
  event: RememberEvent,
  notificationsEnabled: boolean
): Promise<void> {
  const map = await getScheduledMap();
  const existingForEvent = Object.values(map).filter((r) => r.eventId === event.id);
  const desiredKeys = new Set<string>();

  if (notificationsEnabled && event.reminders.length > 0) {
    const now = new Date();
    const rangeEnd = addDays(now, lookaheadDaysFor(event.recurrence.frequency));
    const occurrences = getOccurrencesInRange(event, now, rangeEnd);

    for (const occ of occurrences) {
      if (occ.isCompleted) continue;
      for (const reminder of event.reminders) {
        const minutesBefore =
          reminder.offset === 'custom'
            ? reminder.customMinutes ?? 0
            : REMINDER_OFFSET_MINUTES[reminder.offset];
        const triggerDate = reminderTriggerDate(occ.occurrenceDate, event.time, minutesBefore);
        if (triggerDate.getTime() <= Date.now()) continue; // never schedule into the past

        const key = `${event.id}:${occ.occurrenceDate}:${reminder.id}`;
        desiredKeys.add(key);
        if (map[key]) continue; // already scheduled — idempotent, skip

        try {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: buildNotificationContent(event, occ.occurrenceDate),
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: ANDROID_CHANNEL_ID,
            },
          });
          map[key] = {
            key,
            eventId: event.id,
            reminderId: reminder.id,
            occurrenceDate: occ.occurrenceDate,
            notificationId,
            triggerTimeIso: triggerDate.toISOString(),
          };
        } catch (e) {
          console.warn('[notifications] failed to schedule', key, e);
        }
      }
    }
  }

  // Cancel anything tracked for this event that is no longer desired.
  for (const record of existingForEvent) {
    if (!desiredKeys.has(record.key)) {
      await Notifications.cancelScheduledNotificationAsync(record.notificationId).catch(() => {});
      delete map[record.key];
    }
  }

  await persistScheduledMap(map);
}

/** Cancels and untracks every scheduled notification for an event (used on delete). */
export async function cancelAllNotificationsForEvent(eventId: string): Promise<void> {
  const map = await getScheduledMap();
  const toCancel = Object.values(map).filter((r) => r.eventId === eventId);
  for (const record of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(record.notificationId).catch(() => {});
    delete map[record.key];
  }
  await persistScheduledMap(map);
}

/** Resyncs every event's notifications. Called once on app launch and on foreground. */
export async function syncAllEventNotifications(
  events: RememberEvent[],
  notificationsEnabled: boolean
): Promise<void> {
  for (const event of events) {
    await syncEventNotifications(event, notificationsEnabled && !event.completed);
  }
}

// ----------------------------------------------------------------------------
// Developer test helpers (section: Notification Testing)
// ----------------------------------------------------------------------------
export async function scheduleTestNotification(): Promise<{ id: string }> {
  await ensureAndroidChannel();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Test Reminder',
      body: 'Your RememberMe notification system is working!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  return { id };
}

export async function getNativeScheduledCount(): Promise<number> {
  const list = await Notifications.getAllScheduledNotificationsAsync();
  return list.length;
}
