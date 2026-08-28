import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, format, parseISO } from 'date-fns';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { usePeopleStore } from '@/store/peopleStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Card, SectionHeader, SecondaryButton, PrimaryButton, EmptyState } from '@/components/ui';
import { EVENT_CATEGORIES, REMINDER_OFFSET_LABELS, ChecklistItem } from '@/types';
import { formatDateLong, formatTime12h, countdownLabel } from '@/lib/dateUtils';
import { suggestionsForCategory } from '@/lib/suggestions';
import { greetingsForCategory } from '@/lib/greetings';
import { generateId } from '@/lib/id';

export default function EventDetailScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EventDetail'>>();
  const { colors } = useAppTheme();
  const { eventId, occurrenceDate } = route.params;
  const event = useEventsStore((s) => s.events[eventId]);
  const people = usePeopleStore((s) => s.people);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!event) {
    return (
      <ScreenContainer contentContainerStyle={{ padding: 20 }}>
        <EmptyState emoji="🗑️" title="This event was deleted" />
      </ScreenContainer>
    );
  }

  const meta = EVENT_CATEGORIES.find((c) => c.key === event.category)!;
  const person = event.personId ? people[event.personId] : undefined;
  const isCompleted =
    event.recurrence.frequency === 'none'
      ? event.completed
      : !!event.completedOccurrences?.includes(occurrenceDate);

  const onToggleComplete = () => {
    useEventsStore.getState().toggleComplete(event.id, occurrenceDate);
  };

  const onSnooze = () => {
    const nextDate = format(addDays(parseISO(occurrenceDate), 1), 'yyyy-MM-dd');
    if (event.recurrence.frequency === 'none') {
      useEventsStore.getState().updateEvent(event.id, { date: nextDate });
    } else {
      Alert.alert('Snooze', 'This is a recurring event — snoozing shifts the very next occurrence by one day is not supported yet. Edit the event to change its schedule.');
    }
  };

  const onDelete = () => {
    Alert.alert('Delete this event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await useEventsStore.getState().deleteEvent(event.id);
          nav.goBack();
        },
      },
    ]);
  };

  const addChecklistItem = () => {
    if (!checklistDraft.trim()) return;
    const item: ChecklistItem = { id: generateId('chk_'), text: checklistDraft.trim(), done: false };
    useEventsStore.getState().updateEvent(event.id, { checklist: [...(event.checklist ?? []), item] });
    setChecklistDraft('');
  };

  const toggleChecklistItem = (itemId: string) => {
    const next = (event.checklist ?? []).map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    useEventsStore.getState().updateEvent(event.id, { checklist: next });
  };

  const removeChecklistItem = (itemId: string) => {
    const next = (event.checklist ?? []).filter((c) => c.id !== itemId);
    useEventsStore.getState().updateEvent(event.id, { checklist: next });
  };

  const suggestions = suggestionsForCategory(event.category);
  const greetings =
    event.category === 'birthday' || event.category === 'anniversary' || event.category === 'wedding'
      ? greetingsForCategory(event.category, person?.name)
      : [];

  return (
    <ScreenContainer contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 40 }}>{meta.emoji}</Text>
      <Text style={[styles.title, { color: colors.text, textDecorationLine: isCompleted ? 'line-through' : 'none' }]}>
        {event.title}
      </Text>
      <Text style={[styles.countdown, { color: colors.primary }]}>
        {countdownLabel(occurrenceDate, event.time)}
      </Text>

      <Card style={{ marginTop: 16 }}>
        <InfoRow label="Category" value={meta.label} />
        <InfoRow label="Date" value={formatDateLong(occurrenceDate)} />
        {!event.isAllDay && (
          <InfoRow label="Time" value={event.endTime ? `${formatTime12h(event.time)} – ${formatTime12h(event.endTime)}` : formatTime12h(event.time)} />
        )}
        {person && <InfoRow label="Person" value={person.name} />}
        {event.location ? <InfoRow label="Location" value={event.location} /> : null}
        {event.description ? <InfoRow label="Notes" value={event.description} /> : null}
        <InfoRow
          label="Priority"
          value={event.priority === 'very_important' ? 'Very Important ⭐⭐⭐' : event.priority === 'important' ? 'Important ⭐⭐' : 'Normal ⭐'}
        />
        <InfoRow
          label="Reminders"
          value={event.reminders.length ? event.reminders.map((r) => REMINDER_OFFSET_LABELS[r.offset]).join(', ') : 'None'}
        />
        <InfoRow
          label="Recurrence"
          value={event.recurrence.frequency === 'none' ? 'Does not repeat' : capitalize(event.recurrence.frequency)}
        />
      </Card>

      {suggestions.length > 0 && (
        <>
          <SectionHeader title="Suggestions" />
          <Card>
            {suggestions.map((s, i) => (
              <Text key={i} style={{ color: colors.text, fontSize: 14, marginBottom: i < suggestions.length - 1 ? 8 : 0 }}>
                💡 {s}
              </Text>
            ))}
          </Card>
        </>
      )}

      {greetings.length > 0 && (
        <>
          <SectionHeader title="Greeting Messages" />
          {greetings.map((g, i) => (
            <Card key={i} style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                {g.label}
              </Text>
              <Text style={{ color: colors.text, fontSize: 14, marginBottom: 10 }}>{g.text}</Text>
              <SecondaryButton
                title={copiedIndex === i ? 'Copied ✓' : 'Copy Message'}
                onPress={async () => {
                  await Clipboard.setStringAsync(g.text);
                  setCopiedIndex(i);
                  setTimeout(() => setCopiedIndex(null), 1500);
                }}
              />
            </Card>
          ))}
        </>
      )}

      <SectionHeader title="Preparation Checklist" />
      <Card>
        {(event.checklist ?? []).map((item) => (
          <Pressable key={item.id} onPress={() => toggleChecklistItem(item.id)} style={styles.checklistRow}>
            <View
              style={[
                styles.checkbox,
                { borderColor: item.done ? colors.success : colors.border, backgroundColor: item.done ? colors.success : 'transparent' },
              ]}
            >
              {item.done && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
            </View>
            <Text
              style={{
                flex: 1,
                marginLeft: 10,
                color: colors.text,
                textDecorationLine: item.done ? 'line-through' : 'none',
              }}
            >
              {item.text}
            </Text>
            <Pressable onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
              <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
            </Pressable>
          </Pressable>
        ))}
        {(event.checklist ?? []).length === 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>No checklist items yet.</Text>
        )}
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TextInput
            value={checklistDraft}
            onChangeText={setChecklistDraft}
            onSubmitEditing={addChecklistItem}
            placeholder="Add checklist item..."
            placeholderTextColor={colors.textFaint}
            style={[styles.checklistInput, { borderColor: colors.border, color: colors.text }]}
          />
          <Pressable onPress={addChecklistItem} style={[styles.addChecklistBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+</Text>
          </Pressable>
        </View>
      </Card>

      <PrimaryButton
        title={isCompleted ? 'Mark Incomplete' : '✓ Mark Complete'}
        onPress={onToggleComplete}
        style={{ marginTop: 24 }}
      />
      <SecondaryButton title="Edit Event" onPress={() => nav.navigate('AddEditEvent', { eventId: event.id })} style={{ marginTop: 10 }} />
      <SecondaryButton title="Snooze 1 Day" onPress={onSnooze} style={{ marginTop: 10 }} />
      <SecondaryButton title="Delete Event" tone="danger" onPress={onDelete} style={{ marginTop: 10 }} />
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 15 }}>{value}</Text>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  countdown: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checklistInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  addChecklistBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
