import { create } from 'zustand';
import { Person } from '@/types';
import { readJson, writeJson, StorageKeys } from '@/lib/storage';
import { generateId } from '@/lib/id';
import { useEventsStore } from './eventsStore';

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

function nextOccurrenceIsoForMonthDay(monthDay: string): string {
  // monthDay = "MM-dd". Anchor date can be any past year; recurrence handles
  // the yearly repeat, so we anchor to the current year (or next year if the
  // month/day has already passed this year) purely for a sensible first date.
  const [mm, dd] = monthDay.split('-').map(Number);
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
  const events = useEventsStore.getState();
  const existingId = kind === 'birthday' ? person.birthdayEventId : person.anniversaryEventId;

  if (!monthDay) {
    // Field was cleared — remove the linked event if one exists.
    if (existingId) await events.deleteEvent(existingId);
    return { eventId: null };
  }

  const isoDate = nextOccurrenceIsoForMonthDay(monthDay);
  const title = kind === 'birthday' ? `${person.name}'s Birthday` : `${person.name}'s Anniversary`;
  const category = kind === 'birthday' ? 'birthday' : 'anniversary';
  const defaultReminders =
    kind === 'birthday'
      ? (['30d', '7d', '3d', '1d', 'at_time'] as const)
      : (['7d', '1d', 'at_time'] as const);

  if (existingId && events.events[existingId]) {
    // Update the ONE existing linked event in place — never create a second one.
    await events.updateEvent(existingId, { title, date: isoDate });
    return { eventId: existingId };
  }

  const id = generateId('evt_');
  const now = new Date().toISOString();
  await events.createEvent({
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
  });
  return { eventId: id };
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  people: {},
  loaded: false,

  load: async () => {
    const stored = await readJson<Record<string, Person>>(StorageKeys.people, {});
    set({ people: stored, loaded: true });
  },

  addPerson: async (input) => {
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
    if (state.people[id]) return state.people[id]; // idempotency guard

    const bday = await syncLinkedEvent(person, 'birthday', person.birthday);
    person = { ...person, birthdayEventId: bday.eventId };
    const anniv = await syncLinkedEvent(person, 'anniversary', person.anniversary);
    person = { ...person, anniversaryEventId: anniv.eventId };

    const next = { ...get().people, [id]: person };
    set({ people: next });
    await writeJson(StorageKeys.people, next);
    return person;
  },

  updatePerson: async (id, input) => {
    const existing = get().people[id];
    if (!existing) return;

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
  },

  deletePerson: async (id) => {
    const existing = get().people[id];
    if (!existing) return;
    const events = useEventsStore.getState();
    if (existing.birthdayEventId) await events.deleteEvent(existing.birthdayEventId);
    if (existing.anniversaryEventId) await events.deleteEvent(existing.anniversaryEventId);
    const next = { ...get().people };
    delete next[id];
    set({ people: next });
    await writeJson(StorageKeys.people, next);
  },
}));
