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
import {
  reminderTriggerDate,
  formatTime12h,
  formatDateShort,
} from './dateUtils';
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

// ----------------------------------------------------------------------------
// Android notification channel
// ----------------------------------------------------------------------------
// IMPORTANT:
// We use a NEW channel ID so an old silent "default" channel does not
// continue to control the notification sound.
const ANDROID_CHANNEL_ID = 'reminders-v2';

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(
    ANDROID_CHANNEL_ID,
    {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    }
  );
}

// ----------------------------------------------------------------------------
// Permission handling
// ----------------------------------------------------------------------------

export type PermissionState =
  | 'granted'
  | 'denied'
  | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const { status } =
    await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    return 'granted';
  }

  if (status === 'denied') {
    return 'denied';
  }

  return 'undetermined';
}

export async function requestPermissions(): Promise<PermissionState> {
  // Android:
  // Create the notification channel before requesting permission.
  if (Platform.OS === 'android') {
    await ensureAndroidChannel();
  }

  const current =
    await Notifications.getPermissionsAsync();

  // Permission already granted.
  if (current.status === 'granted') {
    return 'granted';
  }

  // --------------------------------------------------------------------------
  // Android 13+ notification permission
  // --------------------------------------------------------------------------
  // Android 13 (API 33) introduced POST_NOTIFICATIONS as a runtime permission.
  // expo-notifications handles the native permission request.
  if (Platform.OS === 'android') {
    const requested =
      await Notifications.requestPermissionsAsync();

    if (requested.status === 'granted') {
      return 'granted';
    }

    if (requested.status === 'denied') {
      return 'denied';
    }

    return 'undetermined';
  }

  // --------------------------------------------------------------------------
  // iOS notification permission
  // --------------------------------------------------------------------------
  const requested =
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

  if (requested.status === 'granted') {
    return 'granted';
  }

  if (requested.status === 'denied') {
    return 'denied';
  }

  return 'undetermined';
}

// ----------------------------------------------------------------------------
// Local persistent map of everything we've scheduled, keyed by
// `${eventId}:${occurrenceDate}:${reminderId}`.
// ----------------------------------------------------------------------------

type ScheduledMap =
  Record<string, ScheduledNotificationRecord>;

async function getScheduledMap(): Promise<ScheduledMap> {
  return readJson<ScheduledMap>(
    StorageKeys.scheduledNotifications,
    {}
  );
}

async function persistScheduledMap(
  map: ScheduledMap
): Promise<void> {
  await writeJson(
    StorageKeys.scheduledNotifications,
    map
  );
}

export async function getAllScheduledRecords(): Promise<
  ScheduledNotificationRecord[]
> {
  const map = await getScheduledMap();

  return Object.values(map).sort((a, b) =>
    a.triggerTimeIso.localeCompare(b.triggerTimeIso)
  );
}

function lookaheadDaysFor(
  freq: RecurrenceFrequency
): number {
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

function categoryEmoji(
  category: RememberEvent['category']
): string {
  return (
    EVENT_CATEGORIES.find(
      (c) => c.key === category
    )?.emoji ?? '⭐'
  );
}

function buildNotificationContent(
  event: RememberEvent,
  occurrenceDate: string
): Notifications.NotificationContentInput {
  const emoji = categoryEmoji(event.category);

  const whenLabel = event.isAllDay
    ? formatDateShort(occurrenceDate)
    : `${formatDateShort(occurrenceDate)} · ${formatTime12h(
        event.time
      )}`;

  // Task notification
  if (event.category === 'task') {
    return {
      title: '📝 You have a task',
      body: `${event.title} · ${whenLabel}`,
      data: {
        eventId: event.id,
        occurrenceDate,
      },
      sound: true,
    };
  }

  // Normal reminder
  return {
    title: `${emoji} ${event.title}`,
    body: whenLabel,
    data: {
      eventId: event.id,
      occurrenceDate,
    },
    sound: true,
  };
}

// ----------------------------------------------------------------------------
// Sync notifications for ONE event
// ----------------------------------------------------------------------------

export async function syncEventNotifications(
  event: RememberEvent,
  notificationsEnabled: boolean
): Promise<void> {
  const map = await getScheduledMap();

  const existingForEvent =
    Object.values(map).filter(
      (r) => r.eventId === event.id
    );

  const desiredKeys = new Set<string>();

  if (
    notificationsEnabled &&
    event.reminders.length > 0
  ) {
    const now = new Date();

    const rangeEnd = addDays(
      now,
      lookaheadDaysFor(
        event.recurrence.frequency
      )
    );

    const occurrences =
      getOccurrencesInRange(
        event,
        now,
        rangeEnd
      );

    for (const occ of occurrences) {
      if (occ.isCompleted) continue;

      for (const reminder of event.reminders) {
        const minutesBefore =
          reminder.offset === 'custom'
            ? reminder.customMinutes ?? 0
            : REMINDER_OFFSET_MINUTES[
                reminder.offset
              ];

        const triggerDate =
          reminderTriggerDate(
            occ.occurrenceDate,
            event.time,
            minutesBefore
          );

        // Do not schedule notifications in the past.
        if (
          triggerDate.getTime() <= Date.now()
        ) {
          continue;
        }

        const key =
          `${event.id}:${occ.occurrenceDate}:${reminder.id}`;

        desiredKeys.add(key);

        // Already scheduled.
        if (map[key]) {
          continue;
        }

        try {
          const notificationId =
            await Notifications.scheduleNotificationAsync(
              {
                content:
                  buildNotificationContent(
                    event,
                    occ.occurrenceDate
                  ),

                trigger: {
                  type:
                    Notifications
                      .SchedulableTriggerInputTypes
                      .DATE,

                  date: triggerDate,

                  // IMPORTANT:
                  // Always use our sound-enabled channel.
                  channelId:
                    ANDROID_CHANNEL_ID,
                },
              }
            );

          map[key] = {
            key,
            eventId: event.id,
            reminderId: reminder.id,
            occurrenceDate:
              occ.occurrenceDate,
            notificationId,
            triggerTimeIso:
              triggerDate.toISOString(),
          };
        } catch (e) {
          console.warn(
            '[notifications] failed to schedule',
            key,
            e
          );
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Cancel notifications that are no longer needed.
  // --------------------------------------------------------------------------

  for (const record of existingForEvent) {
    if (!desiredKeys.has(record.key)) {
      await Notifications
        .cancelScheduledNotificationAsync(
          record.notificationId
        )
        .catch(() => {});

      delete map[record.key];
    }
  }

  await persistScheduledMap(map);
}

// ----------------------------------------------------------------------------
// Cancel ALL notifications for an event
// ----------------------------------------------------------------------------

export async function cancelAllNotificationsForEvent(
  eventId: string
): Promise<void> {
  const map = await getScheduledMap();

  const toCancel =
    Object.values(map).filter(
      (r) => r.eventId === eventId
    );

  for (const record of toCancel) {
    await Notifications
      .cancelScheduledNotificationAsync(
        record.notificationId
      )
      .catch(() => {});

    delete map[record.key];
  }

  await persistScheduledMap(map);
}

// ----------------------------------------------------------------------------
// Sync ALL events
// ----------------------------------------------------------------------------

export async function syncAllEventNotifications(
  events: RememberEvent[],
  notificationsEnabled: boolean
): Promise<void> {
  for (const event of events) {
    await syncEventNotifications(
      event,
      notificationsEnabled &&
        !event.completed
    );
  }
}

// ----------------------------------------------------------------------------
// Developer test notification
// ----------------------------------------------------------------------------

export async function scheduleTestNotification(): Promise<{
  id: string;
}> {
  // Make sure the sound-enabled channel exists.
  await ensureAndroidChannel();

  const id =
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Test Reminder',
        body:
          'Your RememberMe notification system is working!',
        sound: true,
      },

      trigger: {
        type:
          Notifications
            .SchedulableTriggerInputTypes
            .TIME_INTERVAL,

        seconds: 10,

        // Use the same sound-enabled channel.
        channelId:
          ANDROID_CHANNEL_ID,
      },
    });

  return { id };
}

// ----------------------------------------------------------------------------
// Get number of native Android/iOS scheduled notifications
// ----------------------------------------------------------------------------

export async function getNativeScheduledCount(): Promise<number> {
  const list =
    await Notifications.getAllScheduledNotificationsAsync();

  return list.length;
}