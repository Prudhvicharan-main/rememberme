import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, startOfWeek, format, parseISO } from 'date-fns';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, EmptyState } from '@/components/ui';
import { EventListItem } from '@/components/EventListItem';
import { occurrencesForRange } from '@/lib/selectors';
import { categoryTint } from '@/theme/colors';
import { todayIso, formatDayHeader } from '@/lib/dateUtils';

type ViewMode = 'month' | 'week';

export default function CalendarScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useAppTheme();
  const events = useEventsStore((s) => s.events);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [mode, setMode] = useState<ViewMode>('month');

  const monthRange = useMemo(() => {
    const d = parseISO(selectedDate);
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 2, 0);
    return { start, end };
  }, [selectedDate]);

  const monthOccurrences = useMemo(
    () => occurrencesForRange(events, monthRange.start, monthRange.end),
    [events, monthRange]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const occ of monthOccurrences) {
      const color = categoryTint[occ.event.category] ?? colors.primary;
      if (!marks[occ.occurrenceDate]) marks[occ.occurrenceDate] = { dots: [] };
      if (marks[occ.occurrenceDate].dots.length < 3) {
        marks[occ.occurrenceDate].dots.push({ key: occ.event.id, color });
      }
    }
    marks[selectedDate] = { ...(marks[selectedDate] ?? {}), selected: true, selectedColor: colors.primary };
    return marks;
  }, [monthOccurrences, selectedDate, colors.primary]);

  const dayOccurrences = useMemo(() => {
    const d = parseISO(selectedDate);
    return occurrencesForRange(events, d, d);
  }, [events, selectedDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(parseISO(selectedDate));
    return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  }, [selectedDate]);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={[styles.header, { color: colors.text }]}>Calendar</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Your schedule at a glance</Text>
        </View>
        <View style={[styles.segment, { backgroundColor: colors.chipBg }]}>
          {(['month', 'week'] as ViewMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.segmentBtn, mode === m && { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: mode === m ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                {m === 'month' ? 'Month' : 'Week'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'month' ? (
        <Calendar
          current={selectedDate}
          onDayPress={(d: DateData) => setSelectedDate(d.dateString)}
          markingType="multi-dot"
          markedDates={markedDates}
          theme={{
            calendarBackground: colors.surface,
            dayTextColor: colors.text,
            monthTextColor: colors.text,
            textDisabledColor: colors.textFaint,
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            selectedDayBackgroundColor: colors.primary,
          }}
          style={[styles.calendarWidget, { borderColor: colors.border }]}
        />
      ) : (
        <View style={styles.weekStrip}>
          {weekDays.map((iso) => {
            const d = parseISO(iso);
            const isSelected = iso === selectedDate;
            return (
              <Pressable key={iso} onPress={() => setSelectedDate(iso)} style={styles.weekDayCol}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{format(d, 'EEE')}</Text>
                <View
                  style={[
                    styles.weekDayNum,
                    { backgroundColor: isSelected ? colors.primary : 'transparent' },
                  ]}
                >
                  <Text style={{ color: isSelected ? '#fff' : colors.text, fontWeight: '700' }}>
                    {format(d, 'd')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[styles.dayHeading, { color: colors.text }]}>{formatDayHeader(selectedDate)}</Text>
      </View>

      <FlatList
        data={dayOccurrences}
        keyExtractor={(o) => `${o.event.id}:${o.occurrenceDate}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 }}
        ListEmptyComponent={<EmptyState emoji="🗓️" title="No events on this day" />}
        renderItem={({ item }) => (
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
        )}
      />

      <Pressable
        onPress={() => nav.navigate('AddEditEvent', { initialDate: selectedDate })}
        style={[styles.fab, { backgroundColor: colors.primary }]}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  calendarHeader: { paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 12.5, marginTop: 3 },
  calendarWidget: { marginHorizontal: 20, marginTop: 12, borderRadius: 20, borderWidth: 1, overflow: 'hidden', paddingBottom: 6 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 16 },
  weekDayCol: { alignItems: 'center', gap: 6 },
  weekDayNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayHeading: { fontSize: 16, fontWeight: '700' },
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
