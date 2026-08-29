import { EventCategory, RecurrenceFrequency } from '@/types';

export type RootStackParamList = {
  Tabs: undefined;
  Assistant: undefined;
  Calendar: undefined;
  AddEditEvent: {
    eventId?: string;
    initialDate?: string; // yyyy-MM-dd, used when creating from a tapped calendar day
    initialCategory?: EventCategory;
    prefillTitle?: string;
    initialTime?: string | null; // "HH:mm", used when prefilling from the Assistant
    initialRecurrence?: RecurrenceFrequency;
  };
  EventDetail: { eventId: string; occurrenceDate: string };
  AddEditPerson: { personId?: string };
  PersonDetail: { personId: string };
  Settings: undefined;
  NotificationTest: undefined;
};

export type TabParamList = {
  Home: undefined;
  Moments: undefined;
  Meetings: undefined;
  People: undefined;
  Tasks: undefined;
  Assistant: undefined;
};
