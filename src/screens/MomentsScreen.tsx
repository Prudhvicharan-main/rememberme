import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, subDays } from 'date-fns';

import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, EmptyState, Chip, Card } from '@/components/ui';
import { occurrencesForRange } from '@/lib/selectors';
import { formatDateShort, countdownLabel, todayIso } from '@/lib/dateUtils';

type Filter = 'all' | 'birthdays' | 'anniversaries';

export default function MomentsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const events = useEventsStore((s) => s.events);
  const [filter, setFilter] = useState<Filter>('all');

  const moments = useMemo(() => {
    const today = new Date();
    return occurrencesForRange(events, subDays(today, 1), addDays(today, 366))
      .filter((o) => o.event.category === 'birthday' || o.event.category === 'anniversary')
      .filter((o) => filter === 'all' || o.event.category === (filter === 'birthdays' ? 'birthday' : 'anniversary'))
      .sort((a, b) => {
        const ak = `${a.occurrenceDate}T${a.event.time ?? '00:00'}`;
        const bk = `${b.occurrenceDate}T${b.event.time ?? '00:00'}`;
        return ak.localeCompare(bk);
      });
  }, [events, filter]);

  const birthdayCount = moments.filter((o) => o.event.category === 'birthday').length;
  const anniversaryCount = moments.filter((o) => o.event.category === 'anniversary').length;
  const now = todayIso();

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.top}>
        <Text style={[styles.header, { color: colors.text }]}>Moments</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Birthdays, anniversaries and special days worth remembering.</Text>

        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: '#FFF1F2' }]}>
            <Text style={styles.statEmoji}>🎂</Text>
            <Text style={[styles.statValue, { color: '#BE123C' }]}>{birthdayCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Birthdays</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#FFF7ED' }]}>
            <Text style={styles.statEmoji}>💍</Text>
            <Text style={[styles.statValue, { color: '#C2410C' }]}>{anniversaryCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Anniversaries</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Birthdays" selected={filter === 'birthdays'} onPress={() => setFilter('birthdays')} />
          <Chip label="Anniversaries" selected={filter === 'anniversaries'} onPress={() => setFilter('anniversaries')} />
        </View>
      </View>

      <FlatList
        data={moments}
        keyExtractor={(o) => `${o.event.id}:${o.occurrenceDate}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <EmptyState
            emoji="✨"
            title="No moments yet"
            subtitle="Add a birthday or anniversary and it will appear here every year."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.dateRow}>
              <Text style={[styles.date, { color: colors.primary }]}>{formatDateShort(item.occurrenceDate)}</Text>
              <Text style={[styles.countdown, { color: colors.textMuted }]}>
                {item.occurrenceDate === now ? 'Today' : countdownLabel(item.occurrenceDate, item.event.time)}
              </Text>
            </View>
            <Pressable
              style={styles.eventRow}
              onPress={() => nav.navigate('EventDetail', { eventId: item.event.id, occurrenceDate: item.occurrenceDate })}
            >
              <View style={[styles.icon, { backgroundColor: item.event.category === 'birthday' ? '#FFE4E6' : '#FFEDD5' }]}>
                <Text style={{ fontSize: 21 }}>{item.event.category === 'birthday' ? '🎂' : '💍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>{item.event.title}</Text>
                <Text style={[styles.kind, { color: colors.textMuted }]}>
                  {item.event.category === 'birthday' ? 'Birthday' : 'Anniversary'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          </Card>
        )}
      />

      <Pressable
        onPress={() => nav.navigate('AddEditEvent', { initialCategory: 'birthday' })}
        style={[styles.fab, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel="Add moment"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 16 },
  header: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, borderRadius: 18, padding: 12, minHeight: 84 },
  statEmoji: { fontSize: 20 },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  statLabel: { fontSize: 11.5, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  card: { marginBottom: 10, padding: 14 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  date: { fontSize: 12.5, fontWeight: '800' },
  countdown: { fontSize: 11.5 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  kind: { fontSize: 12, marginTop: 3 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
