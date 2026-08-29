import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { useEventsStore } from '@/store/eventsStore';
import { usePeopleStore } from '@/store/peopleStore';
import { useUpdateStore } from '@/store/updateStore';
import { ensureAndroidChannel, getPermissionState, syncAllEventNotifications } from './notifications';
import { createDebouncedWithFlush } from './debounce';
import { logger } from './logger';

/**
 * Runs once on app launch: loads persisted data, ensures the Android
 * notification channel exists, and (if permission is already granted)
 * resyncs every event's scheduled notifications. Resync is diff-based and
 * idempotent (see notifications.ts), so calling it again here — and again
 * whenever the app returns to the foreground — never creates duplicates.
 *
 * Optimizations:
 * - Debounced foreground resync to prevent excessive syncing if app goes
 *   in/out of foreground rapidly (saves battery)
 * - Proper cleanup of listeners on unmount
 * - Error handling to prevent crashes affecting other apps
 */
export function useAppBootstrap(): boolean {
  const [ready, setReady] = useState(false);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadEvents = useEventsStore((s) => s.load);
  const loadPeople = usePeopleStore((s) => s.load);
  const didInit = useRef(false);
  const resyncNotificationsRef = useRef<{
    debounced: () => void;
    flush: () => Promise<void>;
  } | null>(null);

  // Initialize data on app launch
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      try {
        logger.debug('Bootstrapping app...');
        await ensureAndroidChannel();
        await Promise.all([loadSettings(), loadEvents(), loadPeople()]);

        // Check for app updates
        const checkUpdates = useUpdateStore.getState().checkForUpdates;
        await checkUpdates().catch((e) => logger.warn('Failed to check updates:', e));

        const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
        const permission = await getPermissionState();
        if (notificationsEnabled && permission === 'granted') {
          const events = Object.values(useEventsStore.getState().events);
          await syncAllEventNotifications(events);
        }
        logger.debug('Bootstrap complete');
        setReady(true);
      } catch (e) {
        logger.error('Bootstrap error:', e);
        // Still mark as ready even if sync fails - app should be usable
        setReady(true);
      }
    })();

    return () => {
      // Flush any pending notification syncs on unmount
      if (resyncNotificationsRef.current) {
        resyncNotificationsRef.current.flush().catch((e) => logger.error('Flush error:', e));
      }
    };
  }, []);

  // Setup debounced foreground handler
  useEffect(() => {
    // Create debounced resync with 1 second delay to prevent rapid re-syncing
    const resyncNotifications = async () => {
      try {
        const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
        const permission = await getPermissionState();
        if (notificationsEnabled && permission === 'granted') {
          const events = Object.values(useEventsStore.getState().events);
          logger.debug('Resyncing notifications on foreground');
          await syncAllEventNotifications(events);
        }
      } catch (e) {
        logger.error('Foreground resync error:', e);
        // Silently fail - don't crash the app
      }
    };

    resyncNotificationsRef.current = createDebouncedWithFlush(resyncNotifications, 1000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && resyncNotificationsRef.current) {
        resyncNotificationsRef.current.debounced();
      }
    });

    return () => sub.remove();
  }, []);

  return ready;
}
