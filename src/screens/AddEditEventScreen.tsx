import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform, ScrollView, Switch, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { usePeopleStore } from '@/store/peopleStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Label, Chip, PrimaryButton, SecondaryButton, Card } from '@/components/ui';
import { generateId } from '@/lib/id';
import {
  EVENT_CATEGORIES,
  EventCategory,
  ReminderOffsetKey,
  REMINDER_OFFSET_LABELS,
  Priority,
  RecurrenceFrequency,
  Reminder,
  RememberEvent,
} from '@/types';
import { todayIso } from '@/lib/dateUtils';

const REMINDER_PRESETS: ReminderOffsetKey[] = [
  'at_time', '10m', '15m', '30m', '1h', '2h', '1d', '2d', '3d', '7d', '14d', '30d',
];
const RECURRENCE_OPTIONS: { key: RecurrenceFrequency; label: string }[] = [
  { key: 'none', label: 'Does not repeat' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];
const PRIORITY_OPTIONS: { key: Priority; label: string; emoji: string }[] = [
  { key: 'normal', label: 'Normal', emoji: '⭐' },
  { key: 'important', label: 'Important', emoji: '⭐⭐' },
  { key: 'very_important', label: 'Very Important', emoji: '⭐⭐⭐' },
];

export default function AddEditEventScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditEvent'>>();
  const { colors } = useAppTheme();
  const eventsMap = useEventsStore((s) => s.events);
  const people = usePeopleStore((s) => s.people);
  const defaultReminders = useSettingsStore((s) => s.settings.defaultReminders);

  const existing = route.params?.eventId ? eventsMap[route.params.eventId] : undefined;

  // The id is generated exactly ONCE per time this screen is mounted, and
  // reused on every Save press for this session. Combined with the
  // idempotency guard in eventsStore.createEvent, a rapid double-tap on
  // Save can never produce two records — the second call just returns the
  // record the first call already created.
  const idRef = useRef(existing?.id ?? generateId('evt_'));
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(existing?.title ?? route.params?.prefillTitle ?? '');
  const [category, setCategory] = useState<EventCategory>(
    existing?.category ?? route.params?.initialCategory ?? 'event'
  );
  const [date, setDate] = useState(existing?.date ?? route.params?.initialDate ?? todayIso());
  const [isAllDay, setIsAllDay] = useState(
    existing?.isAllDay ?? (route.params?.initialTime === null ? true : false)
  );
  const [time, setTime] = useState<string | null>(
    existing?.time ?? route.params?.initialTime ?? '09:00'
  );
  const [endTime, setEndTime] = useState<string | null>(existing?.endTime ?? null);
  const [location, setLocation] = useState(existing?.location ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'normal');
  const [personId, setPersonId] = useState<string | null | undefined>(existing?.personId);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>(
    existing?.recurrence.frequency ?? route.params?.initialRecurrence ?? 'none'
  );
  const [reminders, setReminders] = useState<Reminder[]>(
    existing?.reminders ?? initialReminders(category, defaultReminders)
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const isEditing = !!existing;
  const canSave = title.trim().length > 0;
  const peopleList = useMemo(() => Object.values(people).sort((a, b) => a.name.localeCompare(b.name)), [people]);

  function toggleReminder(offset: ReminderOffsetKey) {
    setReminders((prev) => {
      const already = prev.find((r) => r.offset === offset);
      if (already) return prev.filter((r) => r.offset !== offset);
      return [...prev, { id: generateId('rem_'), offset }];
    });
  }

  async function onSave() {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record: RememberEvent = {
        id: idRef.current,
        title: title.trim(),
        category,
        date,
        time: isAllDay ? null : time,
        endTime: isAllDay ? null : endTime,
        isAllDay,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        description: description.trim() || undefined,
        personId: personId ?? undefined,
        location: location.trim() || undefined,
        priority,
        recurrence: { frequency: recurrence },
        reminders,
        checklist: existing?.checklist ?? [],
        completed: existing?.completed ?? false,
        completedOccurrences: existing?.completedOccurrences ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (isEditing) {
        await useEventsStore.getState().updateEvent(idRef.current, record);
      } else {
        await useEventsStore.getState().createEvent(record);
      }
      nav.goBack();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <ScreenContainer contentContainerStyle={{ padding: 20 }}>
      <Label>Event Title</Label>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Call Friend"
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <Label style={{ marginTop: 18 }}>Category</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {EVENT_CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={c.label}
            emoji={c.emoji}
            selected={category === c.key}
            onPress={() => setCategory(c.key)}
          />
        ))}
      </View>

      <Label style={{ marginTop: 18 }}>Date</Label>
      <Card onPress={() => setShowDatePicker(true)}>
        <Text style={{ color: colors.text }}>📅 {date}</Text>
      </Card>
      {showDatePicker && (
        <DateTimePicker
          value={new Date(date + 'T00:00:00')}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (d) setDate(isoFromDate(d));
          }}
        />
      )}

      <View style={styles.rowBetween}>
        <Label style={{ marginTop: 18 }}>All-day event</Label>
        <Switch value={isAllDay} onValueChange={setIsAllDay} style={{ marginTop: 12 }} />
      </View>

      {!isAllDay && (
        <>
          <Label style={{ marginTop: 6 }}>Time</Label>
          <Card onPress={() => setShowTimePicker(true)}>
            <Text style={{ color: colors.text }}>⏰ {time ?? '09:00'}</Text>
          </Card>
          {showTimePicker && (
            <DateTimePicker
              value={timeStringToDate(time ?? '09:00')}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (d) setTime(dateToTimeString(d));
              }}
            />
          )}

          {(category === 'meeting' || category === 'work') && (
            <>
              <Label style={{ marginTop: 14 }}>End time (optional — duration)</Label>
              <Card onPress={() => setShowEndTimePicker(true)}>
                <Text style={{ color: colors.text }}>🏁 {endTime ?? 'Not set'}</Text>
              </Card>
              {showEndTimePicker && (
                <DateTimePicker
                  value={timeStringToDate(endTime ?? time ?? '10:00')}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowEndTimePicker(Platform.OS === 'ios');
                    if (d) setEndTime(dateToTimeString(d));
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {(category === 'meeting' || category === 'appointment' || category === 'event' || category === 'wedding') && (
        <>
          <Label style={{ marginTop: 18 }}>Location</Label>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. College"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          />
        </>
      )}

      <Label style={{ marginTop: 18 }}>Person (optional)</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="None" selected={!personId} onPress={() => setPersonId(null)} />
          {peopleList.map((p) => (
            <Chip key={p.id} label={p.name} selected={personId === p.id} onPress={() => setPersonId(p.id)} />
          ))}
        </View>
      </ScrollView>

      <Label style={{ marginTop: 18 }}>Priority</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {PRIORITY_OPTIONS.map((p) => (
          <Chip key={p.key} label={p.label} selected={priority === p.key} onPress={() => setPriority(p.key)} />
        ))}
      </View>

      <Label style={{ marginTop: 18 }}>Recurrence</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {RECURRENCE_OPTIONS.map((r) => (
          <Chip key={r.key} label={r.label} selected={recurrence === r.key} onPress={() => setRecurrence(r.key)} />
        ))}
      </View>

      <Label style={{ marginTop: 18 }}>Reminders</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {REMINDER_PRESETS.map((offset) => (
          <Chip
            key={offset}
            label={REMINDER_OFFSET_LABELS[offset]}
            selected={!!reminders.find((r) => r.offset === offset)}
            onPress={() => toggleReminder(offset)}
          />
        ))}
      </View>

      <Label style={{ marginTop: 18 }}>Notes</Label>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Add a note..."
        placeholderTextColor={colors.textFaint}
        multiline
        style={[
          styles.input,
          { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, height: 90, textAlignVertical: 'top' },
        ]}
      />

      <PrimaryButton
        title={isEditing ? 'Save Changes' : '✅ Create Event'}
        onPress={onSave}
        disabled={!canSave}
        loading={saving}
        style={{ marginTop: 28 }}
      />
      <SecondaryButton title="Cancel" onPress={() => nav.goBack()} style={{ marginTop: 10 }} />
    </ScreenContainer>
  );
}

function initialReminders(
  category: EventCategory,
  defaults: Partial<Record<EventCategory, ReminderOffsetKey[]>>
): Reminder[] {
  const offsets = defaults[category] ?? ['30m'];
  return offsets.map((offset) => ({ id: generateId('rem_'), offset }));
}

function isoFromDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function timeStringToDate(t: string): Date {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function dateToTimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
