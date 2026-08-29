import { create } from 'zustand';
import { RememberEvent } from '@/types';
import { readJson, writeJson, StorageKeys } from '@/lib/storage';
import { syncEventNotifications, cancelAllNotificationsForEvent } from '@/lib/notifications';
import { useSettingsStore } from './settingsStore';
import { logger } from '@/lib/logger';

interface EventsState {
  events: Record<string, RememberEvent>;
  loaded: boolean;
  load: () => Promise<void>;
  /**
   * Creates an event. The caller (Add Event screen) generates the id ONCE
   * when the form opens and passes the same fully-formed record every time
   * Save is invoked. If an event with this id already exists, this is a
   * no-op that returns the existing record — that's what makes rapid
   * double-taps on Save safe: the second call can never insert a second
   * record for the same id.
   *
   * IMPROVEMENTS:
   * - Input validation to prevent corrupted data
   * - Better error handling with logging
   */
  createEvent: (event: RememberEvent) => Promise<RememberEvent>;
  updateEvent: (id: string, patch: Partial<RememberEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  toggleComplete: (id: string, occurrenceDate?: string) => Promise<void>;
}

/**
 * Validate that an event has all required fields.
 * Prevents corrupted data from being stored.
 */
function validateEvent(event: RememberEvent): boolean {
  return !!(
    event.id &&
    event.title &&
    event.title.trim().length > 0 &&
    event.category &&
    event.date &&
    event.reminders &&
    Array.isArray(event.reminders) &&
    event.recurrence
  );
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: {},
  loaded: false,

  load: async () => {
    try {
      const stored = await readJson<Record<string, RememberEvent>>(StorageKeys.events, {});
      // Filter out any corrupted events
      const validated = Object.entries(stored).reduce(
        (acc, [id, event]) => {
          if (validateEvent(event)) {
            acc[id] = event;
          } else {
            logger.warn(`Skipping corrupted event: ${id}`);
          }
          return acc;
        },
        {} as Record<string, RememberEvent>
      );
      set({ events: validated, loaded: true });
    } catch (e) {
      logger.error('Failed to load events:', e);
      set({ events: {}, loaded: true });
    }
  },

  createEvent: async (event) => {
    try {
      if (!validateEvent(event)) {
        throw new Error('Invalid event data');
      }

      const state = get();
      if (state.events[event.id]) {
        // Idempotency guard: this id was already saved
        return state.events[event.id];
      }

      const next = { ...state.events, [event.id]: event };
      set({ events: next });
      await writeJson(StorageKeys.events, next);

      // Sync notifications after event is saved
      const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
      await syncEventNotifications(event, notificationsEnabled && !event.completed).catch((e) =>
        logger.warn('Failed to sync notifications after create:', e)
      );

      return event;
    } catch (e) {
      logger.error('Failed to create event:', e);
      throw e;
    }
  },

  updateEvent: async (id, patch) => {
    try {
      const state = get();
      const existing = state.events[id];
      if (!existing) {
        logger.warn(`Attempted to update non-existent event: ${id}`);
        return;
      }

      const updated: RememberEvent = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      if (!validateEvent(updated)) {
        throw new Error('Invalid event data after update');
      }

      const next = { ...state.events, [id]: updated };
      set({ events: next });
      await writeJson(StorageKeys.events, next);

      // Re-sync notifications
      const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
      await syncEventNotifications(updated, notificationsEnabled && !updated.completed).catch((e) =>
        logger.warn('Failed to sync notifications after update:', e)
      );
    } catch (e) {
      logger.error('Failed to update event:', e);
      throw e;
    }
  },

  deleteEvent: async (id) => {
    try {
      const state = get();
      if (!state.events[id]) {
        logger.warn(`Attempted to delete non-existent event: ${id}`);
        return;
      }

      const next = { ...state.events };
      delete next[id];
      set({ events: next });
      await writeJson(StorageKeys.events, next);

      // Cancel all notifications for this event
      await cancelAllNotificationsForEvent(id).catch((e) =>
        logger.warn('Failed to cancel notifications after delete:', e)
      );
    } catch (e) {
      logger.error('Failed to delete event:', e);
      throw e;
    }
  },

  toggleComplete: async (id, occurrenceDate) => {
    try {
      const state = get();
      const existing = state.events[id];
      if (!existing) {
        logger.warn(`Attempted to toggle non-existent event: ${id}`);
        return;
      }

      let updated: RememberEvent;
      if (existing.recurrence.frequency === 'none' || !occurrenceDate) {
        const nowCompleted = !existing.completed;
        updated = {
          ...existing,
          completed: nowCompleted,
          completedAt: nowCompleted ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const set_ = new Set(existing.completedOccurrences ?? []);
        if (set_.has(occurrenceDate)) set_.delete(occurrenceDate);
        else set_.add(occurrenceDate);
        updated = {
          ...existing,
          completedOccurrences: Array.from(set_),
          updatedAt: new Date().toISOString(),
        };
      }

      const next = { ...state.events, [id]: updated };
      set({ events: next });
      await writeJson(StorageKeys.events, next);

      // Re-sync notifications
      const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
      await syncEventNotifications(updated, notificationsEnabled && !updated.completed).catch((e) =>
        logger.warn('Failed to sync notifications after toggle:', e)
      );
    } catch (e) {
      logger.error('Failed to toggle event completion:', e);
      throw e;
    }
  },
}));
