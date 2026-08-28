import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin wrapper around AsyncStorage that always reads/writes whole JSON
 * objects keyed by id (Record<id, T>), never arrays. Storing a dictionary
 * instead of an array is a deliberate structural guard against duplicate
 * records: inserting the same id twice is a no-op overwrite, not an append.
 */
export const StorageKeys = {
  events: 'rememberme:events:v1',
  people: 'rememberme:people:v1',
  settings: 'rememberme:settings:v1',
  scheduledNotifications: 'rememberme:scheduled_notifications:v1',
} as const;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[storage] failed to read ${key}`, e);
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[storage] failed to write ${key}`, e);
    throw e;
  }
}

export async function exportAllData(): Promise<string> {
  const [events, people, settings] = await Promise.all([
    AsyncStorage.getItem(StorageKeys.events),
    AsyncStorage.getItem(StorageKeys.people),
    AsyncStorage.getItem(StorageKeys.settings),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      events: events ? JSON.parse(events) : {},
      people: people ? JSON.parse(people) : {},
      settings: settings ? JSON.parse(settings) : {},
    },
    null,
    2
  );
}

export async function deleteAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    StorageKeys.events,
    StorageKeys.people,
    StorageKeys.settings,
    StorageKeys.scheduledNotifications,
  ]);
}
