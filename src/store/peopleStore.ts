import { create } from 'zustand';
import { Person, ReminderOffsetKey } from '@/types';
import { readJson, writeJson, StorageKeys } from '@/lib/storage';
import { generateId } from '@/lib/id';
import { useEventsStore } from './eventsStore';
import { logger } from '@/lib/logger';

export interface PersonInput {
  name: string;
  relationship?: string;
  phoneNumber?: string;
  birthday?: string | null; // MM-dd
  anniversary?: string | null; // MM-dd
  favoriteThings?: string;
  notes?: string;
}

interface PeopleState {
  people: Record<string, Person>;
  loaded: boolean;
  load: () => Promise<void>;
  addPerson: (input: PersonInput) => Promise<Person>;
  updatePerson: (id: string, input: PersonInput) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
}

function validatePersonInput(input: PersonInput): boolean {
  if (!input?.name || input.name.trim().length === 0) {
    return false;
  }

  const checkMonthDay = (value?: string | null) => {
    if (!value) return true;
    const [mm, dd] = value.split('-').map(Number);
    if (mm == null || dd == null) return false;
    return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
  };

  return checkMonthDay(input.birthday) && checkMonthDay(input.anniversary);
}

function nextOccurrenceIsoForMonthDay(monthDay: string): string {
  const [mm, dd] = monthDay.split('-').map(Number);
  if (!mm || !dd || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    throw new Error('Invalid month/day format');
  }

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd);
  if (candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    year += 1;
  }

  const d = new Date(year, mm - 1, dd);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function syncLinkedEvent(
  person: Person,
  kind: 'birthday' | 'anniversary',
  monthDay: string | null | undefined
): Promise<{ eventId: string | null }> {
  try {
    const events = useEventsStore.getState();
    const existingId = kind === 'birthday' ? person.birthdayEventId : person.anniversaryEventId;

    if (!monthDay) {
      if (existingId) {
        await events.deleteEvent(existingId).catch((e) => logger.warn('Failed to delete linked event:', e));
      }
      return { eventId: null };
    }

    const isoDate = nextOccurrenceIsoForMonthDay(monthDay);
    const title = kind === 'birthday' ? `${person.name}'s Birthday` : `${person.name}'s Anniversary`;
    const category = kind === 'birthday' ? 'birthday' : 'anniversary';
    const defaultReminders: ReminderOffsetKey[] =
      kind === 'birthday' ? ['7d', '1d', 'at_time'] : ['7d', '1d', 'at_time'];

    if (existingId && events.events[existingId]) {
      await events
        .updateEvent(existingId, { title, date: isoDate })
        .catch((e) => logger.warn('Failed to update linked event:', e));
      return { eventId: existingId };
    }

    const id = generateId('evt_');
    const now = new Date().toISOString();
    await events
      .createEvent({
        id,
        title,
        category,
        date: isoDate,
        time: null,
        isAllDay: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        personId: person.id,
        priority: 'important',
        recurrence: { frequency: 'yearly' },
        reminders: defaultReminders.map((offset) => ({ id: generateId('rem_'), offset })),
        completed: false,
        createdAt: now,
        updatedAt: now,
      })
      .catch((e) => logger.warn('Failed to create linked event:', e));

    return { eventId: id };
  } catch (e) {
    logger.error('syncLinkedEvent failed:', e);
    return { eventId: null };
  }
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  people: {},
  loaded: false,

  load: async () => {
    try {
      const stored = await readJson<Record<string, Person>>(StorageKeys.people, {});
      const validated = Object.entries(stored).reduce(
        (acc, [id, person]) => {
          if (person?.id && person?.name) {
            acc[id] = person;
          } else {
            logger.warn(`Skipping corrupted person: ${id}`);
          }
          return acc;
        },
        {} as Record<string, Person>
      );

      set({ people: validated, loaded: true });
    } catch (e) {
      logger.error('Failed to load people:', e);
      set({ people: {}, loaded: true });
    }
  },

  addPerson: async (input) => {
    try {
      if (!validatePersonInput(input)) {
        throw new Error('Invalid person input');
      }

      const id = generateId('per_');
      const now = new Date().toISOString();
      let person: Person = {
        id,
        name: input.name,
        relationship: input.relationship,
        phoneNumber: input.phoneNumber,
        birthday: input.birthday ?? null,
        anniversary: input.anniversary ?? null,
        favoriteThings: input.favoriteThings,
        notes: input.notes,
        birthdayEventId: null,
        anniversaryEventId: null,
        createdAt: now,
        updatedAt: now,
      };

      const state = get();
      if (state.people[id]) return state.people[id];

      const bday = await syncLinkedEvent(person, 'birthday', person.birthday);
      person = { ...person, birthdayEventId: bday.eventId };
      const anniv = await syncLinkedEvent(person, 'anniversary', person.anniversary);
      person = { ...person, anniversaryEventId: anniv.eventId };

      const next = { ...state.people, [id]: person };
      set({ people: next });
      await writeJson(StorageKeys.people, next);
      return person;
    } catch (e) {
      logger.error('Failed to add person:', e);
      throw e;
    }
  },

  updatePerson: async (id, input) => {
    try {
      if (!validatePersonInput(input)) {
        throw new Error('Invalid person input');
      }

      const existing = get().people[id];
      if (!existing) {
        logger.warn(`Attempted to update non-existent person: ${id}`);
        return;
      }

      let updated: Person = {
        ...existing,
        name: input.name,
        relationship: input.relationship,
        phoneNumber: input.phoneNumber,
        birthday: input.birthday ?? null,
        anniversary: input.anniversary ?? null,
        favoriteThings: input.favoriteThings,
        notes: input.notes,
        updatedAt: new Date().toISOString(),
      };

      const bday = await syncLinkedEvent(updated, 'birthday', updated.birthday);
      updated = { ...updated, birthdayEventId: bday.eventId };
      const anniv = await syncLinkedEvent(updated, 'anniversary', updated.anniversary);
      updated = { ...updated, anniversaryEventId: anniv.eventId };

      const next = { ...get().people, [id]: updated };
      set({ people: next });
      await writeJson(StorageKeys.people, next);
    } catch (e) {
      logger.error('Failed to update person:', e);
      throw e;
    }
  },

  deletePerson: async (id) => {
    try {
      const existing = get().people[id];
      if (!existing) {
        logger.warn(`Attempted to delete non-existent person: ${id}`);
        return;
      }

      const events = useEventsStore.getState();
      if (existing.birthdayEventId) {
        await events.deleteEvent(existing.birthdayEventId).catch((e) => logger.warn('Failed to delete birthday event:', e));
      }
      if (existing.anniversaryEventId) {
        await events.deleteEvent(existing.anniversaryEventId).catch((e) => logger.warn('Failed to delete anniversary event:', e));
      }

      const next = { ...get().people };
      delete next[id];
      set({ people: next });
      await writeJson(StorageKeys.people, next);
    } catch (e) {
      logger.error('Failed to delete person:', e);
      throw e;
    }
  },
}));
