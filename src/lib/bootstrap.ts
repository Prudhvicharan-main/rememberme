import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { useEventsStore } from '@/store/eventsStore';
import { usePeopleStore } from '@/store/peopleStore';
import { ensureAndroidChannel, getPermissionState, syncAllEventNotifications } from './notifications';

/**
 * Runs once on app launch: loads persisted data, ensures the Android
 * notification channel exists, and (if permission is already granted)
 * resyncs every event's scheduled notifications. Resync is diff-based and
 * idempotent (see notifications.ts), so calling it again here — and again
 * whenever the app returns to the foreground — never creates duplicates.
 */
export function useAppBootstrap(): boolean {
  const [ready, setReady] = useState(false);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadEvents = useEventsStore((s) => s.load);
  const loadPeople = usePeopleStore((s) => s.load);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      await ensureAndroidChannel();
      await Promise.all([loadSettings(), loadEvents(), loadPeople()]);

      const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
      const permission = await getPermissionState();
      if (notificationsEnabled && permission === 'granted') {
        const events = Object.values(useEventsStore.getState().events);
        await syncAllEventNotifications(events, true);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state !== 'active') return;
      const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
      const permission = await getPermissionState();
      if (notificationsEnabled && permission === 'granted') {
        const events = Object.values(useEventsStore.getState().events);
        await syncAllEventNotifications(events, true);
      }
    });
    return () => sub.remove();
  }, []);

  return ready;
}
