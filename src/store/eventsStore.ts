import { create } from 'zustand';
import { RememberEvent } from '@/types';
import { readJson, writeJson, StorageKeys } from '@/lib/storage';
import { syncEventNotifications, cancelAllNotificationsForEvent } from '@/lib/notifications';
import { useSettingsStore } from './settingsStore';

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
   */
  createEvent: (event: RememberEvent) => Promise<RememberEvent>;
  updateEvent: (id: string, patch: Partial<RememberEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  toggleComplete: (id: string, occurrenceDate?: string) => Promise<void>;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: {},
  loaded: false,

  load: async () => {
    const stored = await readJson<Record<string, RememberEvent>>(StorageKeys.events, {});
    set({ events: stored, loaded: true });
  },

  createEvent: async (event) => {
    const state = get();
    if (state.events[event.id]) {
      // Idempotency guard: this id was already saved (e.g. a duplicate Save
      // tap fired the submit handler twice). Do not insert again.
      return state.events[event.id];
    }
    const next = { ...state.events, [event.id]: event };
    set({ events: next });
    await writeJson(StorageKeys.events, next);
    const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
    await syncEventNotifications(event, notificationsEnabled && !event.completed);
    return event;
  },

  updateEvent: async (id, patch) => {
    const state = get();
    const existing = state.events[id];
    if (!existing) return;
    const updated: RememberEvent = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    const next = { ...state.events, [id]: updated };
    set({ events: next });
    await writeJson(StorageKeys.events, next);
    const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
    // Re-syncing (not blindly rescheduling) cancels the old notification and
    // schedules the new one only when the trigger actually changed.
    await syncEventNotifications(updated, notificationsEnabled && !updated.completed);
  },

  deleteEvent: async (id) => {
    const state = get();
    if (!state.events[id]) return;
    const next = { ...state.events };
    delete next[id];
    set({ events: next });
    await writeJson(StorageKeys.events, next);
    await cancelAllNotificationsForEvent(id);
  },

  toggleComplete: async (id, occurrenceDate) => {
    const state = get();
    const existing = state.events[id];
    if (!existing) return;

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
    const notificationsEnabled = useSettingsStore.getState().settings.notificationsEnabled;
    await syncEventNotifications(updated, notificationsEnabled && !updated.completed);
  },
}));
