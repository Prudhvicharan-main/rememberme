import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { Card } from '@/components/ui';
import { classifyMessage, ParsedEventDraft } from '@/lib/nlp';
import { generateId } from '@/lib/id';
import { RememberEvent, ReminderOffsetKey } from '@/types';
import { upcomingOccurrences, upcomingBirthdaysAndAnniversaries, taskOccurrences, todaysOccurrences } from '@/lib/selectors';
import { countdownLabel, formatDateShort, todayIso } from '@/lib/dateUtils';
import { suggestionsForCategory } from '@/lib/suggestions';
import { addDays, format } from 'date-fns';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  draft?: ParsedEventDraft;
  resolved?: boolean; // draft already actioned (created / sent to edit)
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    "Hi! I'm your RememberMe Assistant. Try things like:\n\n" +
    '• "Remind me about John\'s birthday on September 10"\n' +
    '• "Meeting with professor tomorrow at 3 PM"\n' +
    '• "What important things do I have this week?"\n' +
    '• "Whose birthday is coming soon?"',
};

export default function AssistantScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  function pushMessage(m: Omit<ChatMessage, 'id'>) {
    setMessages((prev) => [...prev, { ...m, id: generateId('msg_') }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  function markResolved(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, resolved: true } : m)));
  }

  function onSend() {
    const text = input.trim();
    if (!text) return;
    pushMessage({ role: 'user', text });
    setInput('');
    handleIntent(text);
  }

  function handleIntent(raw: string) {
    const intent = classifyMessage(raw);

    if (intent.type === 'create_event') {
      const d = intent.draft;
      const dateLabel = d.date ? formatDateShort(d.date) : 'a date I couldn\'t quite catch';
      const timeLabel = d.isAllDay ? 'all day' : d.time ? d.time : 'no specific time';
      pushMessage({
        role: 'assistant',
        text: `Got it — "${d.title}" on ${dateLabel}, ${timeLabel}. Want me to create this?`,
        draft: d,
      });
      return;
    }

    if (intent.type === 'query_upcoming') {
      const events = useEventsStore.getState().events;
      const list = upcomingOccurrences(events, intent.rangeDays);
      if (list.length === 0) {
        pushMessage({ role: 'assistant', text: `Nothing important coming up in ${intent.label}. 🎉` });
        return;
      }
      const lines = list
        .slice(0, 10)
        .map((o) => `• ${o.event.title} — ${formatDateShort(o.occurrenceDate)}`)
        .join('\n');
      pushMessage({ role: 'assistant', text: `Here's what's coming up in ${intent.label}:\n\n${lines}` });
      return;
    }

    if (intent.type === 'query_today') {
      const today = todaysOccurrences(useEventsStore.getState().events);
      const list = [...today.timed, ...today.allDay];
      if (list.length === 0) {
        pushMessage({ role: 'assistant', text: 'You have nothing scheduled today.' });
        return;
      }
      pushMessage({ role: 'assistant', text: `Here is what you have today:\n\n${list.map((o) => `• ${o.event.title}${o.event.time ? ` at ${o.event.time}` : ''}`).join('\n')}` });
      return;
    }

    if (intent.type === 'greeting') {
      pushMessage({
        role: 'assistant',
        text: 'Hi! 👋 I can help you add and find meetings, tasks, birthdays and reminders. Try “Meeting with Ravi tomorrow at 4 PM” or “Show my meetings.”',
      });
      return;
    }

    if (intent.type === 'query_meetings') {
      const events = useEventsStore.getState().events;
      const list = upcomingOccurrences(events, 365).filter((o) => o.event.category === 'meeting');
      if (list.length === 0) {
        pushMessage({ role: 'assistant', text: 'You have no upcoming meetings. 📅' });
        return;
      }
      const lines = list
        .slice(0, 10)
        .map((o) => `• ${o.event.title} — ${formatDateShort(o.occurrenceDate)}${o.event.time ? ` at ${o.event.time}` : ''}`)
        .join('\n');
      pushMessage({ role: 'assistant', text: `Here are your upcoming meetings:\n\n${lines}` });
      return;
    }

    if (intent.type === 'query_meetings_tomorrow') {
      const events = useEventsStore.getState().events;
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const list = upcomingOccurrences(events, 2, false).filter(
        (o) => o.event.category === 'meeting' && o.occurrenceDate === tomorrow
      );
      pushMessage({
        role: 'assistant',
        text: list.length
          ? `You have these meetings tomorrow:\n\n${list.map((o) => `• ${o.event.title}${o.event.time ? ` at ${o.event.time}` : ''}`).join('\n')}`
          : 'You have no meetings tomorrow.',
      });
      return;
    }

    if (intent.type === 'query_birthdays') {
      const events = useEventsStore.getState().events;
      const list = upcomingBirthdaysAndAnniversaries(events, 90).filter((o) => o.event.category === 'birthday');
      if (list.length === 0) {
        pushMessage({ role: 'assistant', text: 'You have no upcoming birthdays in the next 90 days.' });
        return;
      }
      const lines = list
        .map((o) => `• ${o.event.title} — ${countdownLabel(o.occurrenceDate, o.event.time)}`)
        .join('\n');
      pushMessage({ role: 'assistant', text: `Coming up:\n\n${lines}` });
      return;
    }

    if (intent.type === 'query_anniversaries') {
      const list = upcomingBirthdaysAndAnniversaries(useEventsStore.getState().events, 365)
        .filter((o) => o.event.category === 'anniversary');
      pushMessage({
        role: 'assistant',
        text: list.length ? `Upcoming anniversaries:\n\n${list.slice(0, 10).map((o) => `• ${o.event.title} — ${countdownLabel(o.occurrenceDate, o.event.time)}`).join('\n')}` : 'You have no upcoming anniversaries.',
      });
      return;
    }

    if (intent.type === 'query_tasks') {
      const list = taskOccurrences(useEventsStore.getState().events).filter((o) => !o.isCompleted);
      pushMessage({
        role: 'assistant',
        text: list.length ? `Here are your tasks:\n\n${list.slice(0, 10).map((o) => `• ${o.event.title} — ${formatDateShort(o.occurrenceDate)}`).join('\n')}` : 'You have no pending tasks.',
      });
      return;
    }

    if (intent.type === 'query_suggestions') {
      const events = Object.values(useEventsStore.getState().events);
      const match = events.find((e) => e.title.toLowerCase().includes(intent.subject.toLowerCase()));
      const suggestions = suggestionsForCategory(match?.category ?? 'event');
      pushMessage({
        role: 'assistant',
        text: `Here are a few ideas${match ? ` for "${match.title}"` : ''}:\n\n${suggestions
          .map((s) => `• ${s}`)
          .join('\n')}`,
      });
      return;
    }

    pushMessage({
      role: 'assistant',
      text: "I didn't quite catch that — try something like \"Call mom Friday at 7 PM\" or ask me what's coming up this week.",
    });
  }

  async function onConfirmCreate(message: ChatMessage) {
    if (!message.draft || !message.draft.date) return;
    const d = message.draft;
    const eventDate: string = d.date!;
    const defaultReminders = useSettingsStore.getState().settings.defaultReminders;
    const reminderOffsets: ReminderOffsetKey[] = defaultReminders[d.category] ?? ['30m'];
    const now = new Date().toISOString();
    const event: RememberEvent = {
      id: generateId('evt_'),
      title: d.title,
      category: d.category,
      date: eventDate,
      time: d.isAllDay ? null : d.time,
      isAllDay: d.isAllDay,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      priority: 'normal',
      recurrence: d.recurrence,
      reminders: reminderOffsets.map((offset) => ({ id: generateId('rem_'), offset })),
      checklist: [],
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    await useEventsStore.getState().createEvent(event);
    markResolved(message.id);
    pushMessage({ role: 'assistant', text: `🎉 Created "${event.title}" for ${formatDateShort(event.date)}.` });
  }

  function onEditBeforeCreate(message: ChatMessage) {
    if (!message.draft) return;
    const d = message.draft;
    markResolved(message.id);
    nav.navigate('AddEditEvent', {
      prefillTitle: d.title,
      initialCategory: d.category,
      initialDate: d.date ?? todayIso(),
      initialTime: d.isAllDay ? null : d.time,
      initialRecurrence: d.recurrence.frequency,
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={[styles.header, { color: colors.text }]}>RememberMe Assistant</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {messages.map((m) => (
          <View key={m.id} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: m.role === 'user' ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: m.role === 'user' ? '#fff' : colors.text, fontSize: 14, lineHeight: 20 }}>
                {m.text}
              </Text>
            </View>

            {m.draft && !m.resolved && (
              <Card style={{ marginTop: 8, maxWidth: '85%' }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                  {m.draft.date ? '' : "I need a date before I can create this — you can add one in the full form."}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {m.draft.date && (
                    <Pressable
                      onPress={() => onConfirmCreate(m)}
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Create Event</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => onEditBeforeCreate(m)}
                    style={[styles.actionBtn, { borderWidth: 1.5, borderColor: colors.primary }]}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                      {m.draft.date ? 'Edit First' : 'Open Full Form'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a reminder or ask a question..."
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={onSend}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />
        <Pressable onPress={onSend} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 24, fontWeight: '800' },
  bubble: { maxWidth: '85%', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  input: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, marginRight: 8, fontSize: 14 },
  sendBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
});
