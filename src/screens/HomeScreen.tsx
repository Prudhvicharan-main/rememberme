import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, endOfMonth, startOfMonth, parseISO } from 'date-fns';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, SectionHeader, Card, EmptyState } from '@/components/ui';
import { EventListItem } from '@/components/EventListItem';
import { occurrencesForRange, todaysOccurrences, upcomingOccurrences } from '@/lib/selectors';
import { countdownLabel, formatDateShort } from '@/lib/dateUtils';
import { suggestionsForCategory } from '@/lib/suggestions';
import { categoryTint } from '@/theme/colors';

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning! 👋';
  if (h < 17) return 'Good afternoon! 👋';
  return 'Good evening! 👋';
}

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const events = useEventsStore((s) => s.events);

  const { timed, allDay } = useMemo(() => todaysOccurrences(events), [events]);
  const upcoming = useMemo(() => upcomingOccurrences(events, 14), [events]);
  const dashboardOccurrences = useMemo(
    () => [...timed, ...allDay, ...upcoming].filter((occ) => !occ.isCompleted),
    [allDay, timed, upcoming]
  );
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().slice(0, 10));
  const monthOccurrences = useMemo(() => {
    const date = parseISO(selectedDate);
    return occurrencesForRange(events, startOfMonth(date), endOfMonth(date));
  }, [events, selectedDate]);
  const selectedOccurrences = useMemo(() => {
    const date = parseISO(selectedDate);
    return occurrencesForRange(events, date, date);
  }, [events, selectedDate]);

  const nearTermHighlights = upcoming.slice(0, 4);
  const meetingCount = dashboardOccurrences.filter((o) => o.event.category === 'meeting').length;
  const taskCount = dashboardOccurrences.filter((o) => o.event.category === 'task').length;
  const birthdayCount = dashboardOccurrences.filter((o) => o.event.category === 'birthday').length;
  const anniversaryCount = dashboardOccurrences.filter((o) => o.event.category === 'anniversary').length;
  const meetings = dashboardOccurrences.filter((o) => o.event.category === 'meeting').slice(0, 3);
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    monthOccurrences.forEach((occ) => {
      marks[occ.occurrenceDate] ??= { dots: [] };
      if (marks[occ.occurrenceDate].dots.length < 3) {
        marks[occ.occurrenceDate].dots.push({ key: occ.event.id, color: categoryTint[occ.event.category] ?? colors.primary });
      }
    });
    marks[selectedDate] = { ...(marks[selectedDate] ?? {}), selected: true, selectedColor: colors.primary };
    return marks;
  }, [colors.primary, monthOccurrences, selectedDate]);

  return (
    <ScreenContainer contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <Text style={[styles.greeting, { color: colors.text }]}>{greetingForNow()}</Text>
      <Text style={[styles.subGreeting, { color: colors.textMuted }]}>Here's what you need to remember today.</Text>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#F1EAFF' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#8B5CF6' }]}><Ionicons name="calendar-outline" size={16} color="#fff" /></View>
          <Text style={[styles.statValue, { color: '#6D28D9' }]}>{meetingCount}</Text>
          <Text style={[styles.statLabel, { color: '#7C6A9C' }]}>Meetings</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#EAF9F2' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}><Ionicons name="checkmark-circle-outline" size={16} color="#fff" /></View>
          <Text style={[styles.statValue, { color: '#047857' }]}>{taskCount}</Text>
          <Text style={[styles.statLabel, { color: '#6A907D' }]}>Tasks</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFF2E8' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#F59E0B' }]}><Ionicons name="gift-outline" size={16} color="#fff" /></View>
          <Text style={[styles.statValue, { color: '#C2410C' }]}>{birthdayCount}</Text>
          <Text style={[styles.statLabel, { color: '#A47D64' }]}>Birthdays</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#EAF4FF' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#3B82F6' }]}><Ionicons name="heart-outline" size={16} color="#fff" /></View>
          <Text style={[styles.statValue, { color: '#1D4ED8' }]}>{anniversaryCount}</Text>
          <Text style={[styles.statLabel, { color: '#6680A8' }]}>Anniversaries</Text>
        </View>
      </View>

      <SectionHeader title="Today" />
      <Card>
        {timed.length === 0 ? (
          <EmptyState emoji="🌤️" title="Nothing scheduled today" subtitle="Enjoy the calm." />
        ) : (
          timed.map((occ, i) => (
            <View key={`${occ.event.id}:${occ.occurrenceDate}`}>
              <EventListItem
                occurrence={occ}
                onToggleComplete={() =>
                  useEventsStore.getState().toggleComplete(occ.event.id, occ.occurrenceDate)
                }
                onPress={() =>
                  nav.navigate('EventDetail', { eventId: occ.event.id, occurrenceDate: occ.occurrenceDate })
                }
              />
              {i < timed.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </View>
          ))
        )}
      </Card>

      {allDay.length > 0 && (
        <>
          <SectionHeader title="All Day" />
          <Card>
            {allDay.map((occ, i) => (
              <View key={`${occ.event.id}:${occ.occurrenceDate}`}>
                <EventListItem
                  occurrence={occ}
                  onPress={() =>
                    nav.navigate('EventDetail', { eventId: occ.event.id, occurrenceDate: occ.occurrenceDate })
                  }
                />
                {i < allDay.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionHeader title="Calendar" />
      <Card style={styles.calendarCard}>
        <Calendar
          current={selectedDate}
          onDayPress={(date: DateData) => setSelectedDate(date.dateString)}
          markingType="multi-dot"
          markedDates={markedDates}
          theme={{ calendarBackground: colors.surface, dayTextColor: colors.text, monthTextColor: colors.text, textDisabledColor: colors.textFaint, todayTextColor: colors.primary, arrowColor: colors.primary }}
        />
        <Text style={[styles.selectedDate, { color: colors.text }]}>{selectedOccurrences.length ? `${selectedOccurrences.length} event${selectedOccurrences.length === 1 ? '' : 's'} on this day` : 'No events on this day'}</Text>
        {selectedOccurrences.slice(0, 3).map((occ) => <Text key={`${occ.event.id}:${occ.occurrenceDate}`} style={[styles.selectedEvent, { color: colors.textMuted }]}>• {occ.event.title}</Text>)}
      </Card>

      <SectionHeader
        title="Upcoming Meetings"
        right={
          <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Meetings' } as never)} hitSlop={8}>
            <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '800' }}>View all</Text>
          </Pressable>
        }
      />
      {meetings.length === 0 ? <Card><EmptyState emoji="📅" title="No upcoming meetings" subtitle="Your next meetings will appear here." /></Card> : meetings.map((occ) => (
        <Card key={`${occ.event.id}:${occ.occurrenceDate}`} style={{ marginBottom: 10 }}>
          <Pressable onPress={() => nav.navigate('EventDetail', { eventId: occ.event.id, occurrenceDate: occ.occurrenceDate })}>
            <Text style={[styles.upcomingWhen, { color: colors.primary }]}>{formatDateShort(occ.occurrenceDate)} · {countdownLabel(occ.occurrenceDate, occ.event.time)}</Text>
            <Text style={[styles.upcomingTitle, { color: colors.text }]}>{occ.event.title}</Text>
            {occ.event.location ? <Text style={[styles.suggestion, { color: colors.textMuted }]}>📍 {occ.event.location}</Text> : null}
          </Pressable>
        </Card>
      ))}

      <Card style={styles.assistantCard}>
        <View style={{ flex: 1 }}><Text style={[styles.calendarTitle, { color: colors.text }]}>RememberMe Assistant</Text><Text style={[styles.calendarSubtitle, { color: colors.textMuted }]}>Need help remembering something?</Text></View>
        <Pressable onPress={() => nav.navigate('Assistant')} style={[styles.assistantButton, { backgroundColor: colors.primary }]}><Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" /><Text style={styles.assistantButtonText}>Ask Assistant</Text></Pressable>
      </Card>

      <SectionHeader title="Upcoming" />
      {nearTermHighlights.length === 0 ? (
        <Card>
          <EmptyState emoji="✨" title="Nothing on the horizon" subtitle="Add an event to get started." />
        </Card>
      ) : (
        nearTermHighlights.map((occ) => {
          const suggestions = suggestionsForCategory(occ.event.category);
          return (
            <Card key={`${occ.event.id}:${occ.occurrenceDate}`} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() =>
                  nav.navigate('EventDetail', { eventId: occ.event.id, occurrenceDate: occ.occurrenceDate })
                }
              >
                <Text style={[styles.upcomingWhen, { color: colors.primary }]}>
                  {formatDateShort(occ.occurrenceDate)} · {countdownLabel(occ.occurrenceDate, occ.event.time)}
                </Text>
                <Text style={[styles.upcomingTitle, { color: colors.text }]}>{occ.event.title}</Text>
                {suggestions.length > 0 && (
                  <Text style={[styles.suggestion, { color: colors.textMuted }]}>
                    💡 {suggestions[0]}
                  </Text>
                )}
              </Pressable>
            </Card>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 26, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  subGreeting: { fontSize: 14, marginTop: 4, marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  upcomingWhen: { fontSize: 12.5, fontWeight: '700', marginBottom: 4 },
  upcomingTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  suggestion: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  statCard: { flex: 1, borderRadius: 18, padding: 12, minHeight: 92 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 21, fontWeight: '800' },
  statLabel: { fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  calendarCard: { padding: 14 },
  calendarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calendarIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calendarTitle: { fontSize: 16, fontWeight: '800' },
  calendarSubtitle: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  openCalendar: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  selectedDate: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  selectedEvent: { fontSize: 12.5, marginTop: 4 },
  assistantCard: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  assistantButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  assistantButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
