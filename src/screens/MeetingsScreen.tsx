import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, subDays, format } from 'date-fns';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, EmptyState, Chip, Card } from '@/components/ui';
import { EventListItem } from '@/components/EventListItem';
import { occurrencesForRange } from '@/lib/selectors';
import { todayIso, formatDateShort, countdownLabel } from '@/lib/dateUtils';

type Filter = 'today' | 'tomorrow' | 'this_week' | 'upcoming' | 'all' | 'past';

export default function MeetingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const events = useEventsStore((s) => s.events);
  const [filter, setFilter] = useState<Filter>('upcoming');

  const today = useMemo(() => new Date(), []);
  const allMeetings = useMemo(() => {
    const occurrences = occurrencesForRange(events, subDays(today, 30), addDays(today, 365))
      .filter((o) => o.event.category === 'meeting');
    return occurrences.sort((a, b) => {
      const aKey = `${a.occurrenceDate}T${a.event.time ?? '23:59'}`;
      const bKey = `${b.occurrenceDate}T${b.event.time ?? '23:59'}`;
      return aKey.localeCompare(bKey);
    });
  }, [events, today]);

  const filtered = useMemo(() => {
    const nowIso = todayIso();
    const tomorrowIso = format(addDays(today, 1), 'yyyy-MM-dd');
    if (filter === 'today') return allMeetings.filter((o) => o.occurrenceDate === nowIso);
    if (filter === 'tomorrow') return allMeetings.filter((o) => o.occurrenceDate === tomorrowIso);
    if (filter === 'this_week') return allMeetings.filter((o) => o.occurrenceDate >= nowIso && o.occurrenceDate <= format(addDays(today, 7), 'yyyy-MM-dd'));
    if (filter === 'past') return allMeetings.filter((o) => o.occurrenceDate < nowIso).reverse();
    if (filter === 'upcoming') return allMeetings.filter((o) => o.occurrenceDate >= nowIso);
    return allMeetings;
  }, [allMeetings, filter]);

  return (
    <ScreenContainer scroll={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.header, { color: colors.text }]}>Meetings</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {filter === 'upcoming' ? 'Your upcoming meetings' : 'Keep every meeting in one place'}
            </Text>
          </View>
        </View>

        <View style={styles.filters}>
          <Chip label="Today" selected={filter === 'today'} onPress={() => setFilter('today')} />
          <Chip label="Tomorrow" selected={filter === 'tomorrow'} onPress={() => setFilter('tomorrow')} />
          <Chip label="This week" selected={filter === 'this_week'} onPress={() => setFilter('this_week')} />
          <Chip label="Upcoming" selected={filter === 'upcoming'} onPress={() => setFilter('upcoming')} />
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Past" selected={filter === 'past'} onPress={() => setFilter('past')} />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => `${o.event.id}:${o.occurrenceDate}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <EmptyState
            emoji="📅"
            title={filter === 'past' ? 'No past meetings' : 'No meetings yet'}
            subtitle={filter === 'past' ? 'Your meeting history will appear here.' : 'Add your first meeting to keep it easy to remember.'}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.meetingCard}>
            <View style={styles.dateRow}>
              <Text style={[styles.dateText, { color: colors.primary }]}>
                {formatDateShort(item.occurrenceDate)}
              </Text>
              <Text style={[styles.countdown, { color: colors.textMuted }]}>
                {countdownLabel(item.occurrenceDate, item.event.time)}
              </Text>
            </View>
            <View style={styles.meetingBody}>
              <View style={[styles.meetingIcon, { backgroundColor: '#EEE7FF' }]}><Ionicons name="calendar-outline" size={20} color="#7C3AED" /></View>
              <View style={{ flex: 1 }}>
            <EventListItem
              occurrence={item}
              showCountdown={false}
              onToggleComplete={() =>
                useEventsStore.getState().toggleComplete(item.event.id, item.occurrenceDate)
              }
              onPress={() =>
                nav.navigate('EventDetail', { eventId: item.event.id, occurrenceDate: item.occurrenceDate })
              }
            />
              </View>
            </View>
            {item.event.location ? <Text style={[styles.location, { color: colors.textMuted }]}>📍 {item.event.location}</Text> : null}
          </Card>
        )}
      />

      <Pressable onPress={() => nav.navigate('AddEditEvent', { initialCategory: 'meeting' })} accessibilityRole="button" accessibilityLabel="Add meeting" style={[styles.fab, { backgroundColor: colors.primary }]}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  meetingCard: { marginBottom: 10, padding: 14 },
  meetingBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meetingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 12.5, marginTop: 3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  dateText: { fontSize: 12.5, fontWeight: '800' },
  countdown: { fontSize: 11.5 },
  location: { fontSize: 12.5, marginTop: 4, marginLeft: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
