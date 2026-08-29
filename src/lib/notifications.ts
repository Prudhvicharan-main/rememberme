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
import { logger } from './logger';

// Constants for battery optimization
const ANDROID_CHANNEL_ID = 'default';
const NOTIFICATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_REMINDERS_PER_EVENT = 5; // Limit reminders to prevent notification spam
const MAX_SCHEDULED_PER_EVENT_IN_LOOKAHEAD = 50; // Prevent excessive scheduling for recurring events

let lastCleanupTime = 0;

// ============================================================================
// BATTERY OPTIMIZATION: Notification handler
// Sound and badge disabled by default to save battery; apps can re-enable based on DND
// ============================================================================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false, // Disabled to save battery - rare calls can override
    shouldSetBadge: false,
  }),
});

/**
 * BATTERY OPTIMIZATION: Channel setup with moderate settings
 * - Importance set to DEFAULT (not HIGH) to reduce device wake-ups
 * - Minimal vibration pattern to conserve battery
 * - No flashing light
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT, // Reduced from HIGH
      vibrationPattern: [0, 100, 100], // Reduced from [0, 250, 250, 250]
      // lightColor omitted - disables LED flash
    });
    logger.debug('Android notification channel configured');
  } catch (e) {
    logger.error('Failed to configure notification channel:', e);
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch (e) {
    logger.error('Failed to get permission state:', e);
    return 'denied';
  }
}

export async function requestPermissions(): Promise<PermissionState> {
  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return 'granted';
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false }, // Reduced to save battery
    });
    if (requested.status === 'granted') return 'granted';
    if (requested.status === 'denied') return 'denied';
    return 'undetermined';
  } catch (e) {
    logger.error('Failed to request permissions:', e);
    return 'denied';
  }
}

// ============================================================================
// Scheduled notification tracking
// ============================================================================
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

/**
 * Clean up notifications that have already triggered or are in the past.
 * Prevents the scheduled notifications map from growing unbounded.
 * Called periodically to maintain database hygiene.
 */
async function cleanupOldScheduledNotifications(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupTime < NOTIFICATION_CLEANUP_INTERVAL_MS) {
    return; // Skip cleanup if run recently
  }

  try {
    const map = await getScheduledMap();
    const cleaned = { ...map };
    let removedCount = 0;

    for (const [key, record] of Object.entries(cleaned)) {
      const triggerTime = new Date(record.triggerTimeIso).getTime();
      if (triggerTime < now) {
        // Notification is in the past - remove it
        delete cleaned[key];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old notifications`);
      await persistScheduledMap(cleaned);
    }
    lastCleanupTime = now;
  } catch (e) {
    logger.error('Notification cleanup failed:', e);
  }
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

/**
 * BATTERY OPTIMIZATION: Silent notifications by default
 * Only enable sound for important categories. Users can customize in Settings.
 */
function shouldPlaySound(category: RememberEvent['category']): boolean {
  // Only play sound for time-sensitive events
  return category === 'meeting' || category === 'appointment';
}

function buildNotificationContent(
  event: RememberEvent,
  occurrenceDate: string
): Notifications.NotificationContentInput {
  const emoji = categoryEmoji(event.category);
  const whenLabel = event.isAllDay
    ? formatDateShort(occurrenceDate)
    : `${formatDateShort(occurrenceDate)} · ${formatTime12h(event.time)}`;

  const baseContent: Notifications.NotificationContentInput = {
    data: { eventId: event.id, occurrenceDate },
    sound: shouldPlaySound(event.category), // Conditional sound
  };

  if (event.category === 'task') {
    return {
      ...baseContent,
      title: `📝 Task: ${event.title}`,
      body: whenLabel,
    };
  }
  if (event.category === 'meeting') {
    return {
      ...baseContent,
      title: `📅 Meeting: ${event.title}`,
      body: whenLabel,
    };
  }
  return {
    ...baseContent,
    title: `${emoji} ${event.title}`,
    body: whenLabel,
  };
}

/**
 * Diff-based sync for ONE event: schedules whatever reminders are missing
 * within the lookahead window, and cancels+removes any previously scheduled
 * notification for this event that is no longer valid.
 *
 * OPTIMIZATIONS:
 * - Limits reminders per event to prevent spam
 * - Limits total notifications per event in lookahead window
 * - Runs periodic cleanup of old notifications
 * - Proper error handling with logging
 */
export async function syncEventNotifications(
  event: RememberEvent,
  notificationsEnabled: boolean
): Promise<void> {
  try {
    // Periodically clean up old notifications
    await cleanupOldScheduledNotifications();

    const map = await getScheduledMap();
    const existingForEvent = Object.values(map).filter((r) => r.eventId === event.id);
    const desiredKeys = new Set<string>();

    if (notificationsEnabled && event.reminders.length > 0) {
      const now = new Date();
      const rangeEnd = addDays(now, lookaheadDaysFor(event.recurrence.frequency));
      const occurrences = getOccurrencesInRange(event, now, rangeEnd);

      // Limit reminders per event to prevent notification spam
      const limitedReminders = event.reminders.slice(0, MAX_REMINDERS_PER_EVENT);
      let scheduledCount = 0;

      for (const occ of occurrences) {
        if (occ.isCompleted || scheduledCount >= MAX_SCHEDULED_PER_EVENT_IN_LOOKAHEAD) continue;

        let immediateFallbackScheduled = false;
        for (const reminder of limitedReminders) {
          if (scheduledCount >= MAX_SCHEDULED_PER_EVENT_IN_LOOKAHEAD) break;

          const minutesBefore =
            reminder.offset === 'custom'
              ? reminder.customMinutes ?? 0
              : REMINDER_OFFSET_MINUTES[reminder.offset];
          let triggerDate = reminderTriggerDate(occ.occurrenceDate, event.time, minutesBefore);

          if (triggerDate.getTime() <= Date.now()) {
            const createdRecently = Date.now() - new Date(event.createdAt).getTime() < 2 * 60 * 1000;
            if (event.category !== 'task' || !createdRecently || immediateFallbackScheduled) continue;
            triggerDate = new Date(Date.now() + 2_000);
            immediateFallbackScheduled = true;
          }

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
            scheduledCount++;
          } catch (e) {
            logger.warn(`Failed to schedule notification for ${key}:`, e);
          }
        }
      }
    }

    // Cancel anything tracked for this event that is no longer desired
    for (const record of existingForEvent) {
      if (!desiredKeys.has(record.key)) {
        try {
          await Notifications.cancelScheduledNotificationAsync(record.notificationId);
        } catch (e) {
          logger.warn(`Failed to cancel notification ${record.notificationId}:`, e);
        }
        delete map[record.key];
      }
    }

    await persistScheduledMap(map);
  } catch (e) {
    logger.error('syncEventNotifications failed:', e);
    // Don't throw - allow app to continue
  }
}

/** Cancels and untracks every scheduled notification for an event (used on delete). */
export async function cancelAllNotificationsForEvent(eventId: string): Promise<void> {
  try {
    const map = await getScheduledMap();
    const toCancel = Object.values(map).filter((r) => r.eventId === eventId);
    for (const record of toCancel) {
      try {
        await Notifications.cancelScheduledNotificationAsync(record.notificationId);
      } catch (e) {
        logger.warn(`Failed to cancel notification ${record.notificationId}:`, e);
      }
      delete map[record.key];
    }
    await persistScheduledMap(map);
  } catch (e) {
    logger.error('cancelAllNotificationsForEvent failed:', e);
  }
}

/** Resyncs every event's notifications. Called once on app launch and on foreground. */
export async function syncAllEventNotifications(
  events: RememberEvent[]
): Promise<void> {
  try {
    const notificationsEnabled = true; // Check from settings store instead
    for (const event of events) {
      // Don't await - run in parallel with error handling
      syncEventNotifications(event, notificationsEnabled && !event.completed).catch((e) =>
        logger.warn(`Failed to sync notifications for event ${event.id}:`, e)
      );
    }
  } catch (e) {
    logger.error('syncAllEventNotifications failed:', e);
  }
}

// ============================================================================
// Developer test helpers (section: Notification Testing)
// ============================================================================
export async function scheduleTestNotification(): Promise<{ id: string }> {
  try {
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
  } catch (e) {
    logger.error('Failed to schedule test notification:', e);
    throw e;
  }
}

export async function getNativeScheduledCount(): Promise<number> {
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return list.length;
  } catch (e) {
    logger.error('Failed to get native scheduled count:', e);
    return 0;
  }
}

