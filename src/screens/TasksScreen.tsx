import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useEventsStore } from '@/store/eventsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, EmptyState, Chip, SectionHeader, Card } from '@/components/ui';
import { EventListItem } from '@/components/EventListItem';
import { taskOccurrences, overdueOccurrences } from '@/lib/selectors';
import { priorityColors } from '@/theme/colors';

type Filter = 'all' | 'pending' | 'completed' | 'high_priority';

export default function TasksScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const events = useEventsStore((s) => s.events);
  const [filter, setFilter] = useState<Filter>('pending');

  const overdue = useMemo(() => overdueOccurrences(events).filter((o) => o.event.category !== 'birthday'), [events]);
  const all = useMemo(() => taskOccurrences(events), [events]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return all.filter((o) => !o.isCompleted);
      case 'completed':
        return all.filter((o) => o.isCompleted);
      case 'high_priority':
        return all.filter((o) => o.event.priority === 'very_important' && !o.isCompleted);
      default:
        return all;
    }
  }, [all, filter]);

  return (
    <ScreenContainer scroll={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.header, { color: colors.text }]}>Tasks</Text>
        </View>

        <View style={styles.filterRow}>
          <Chip label="Pending" selected={filter === 'pending'} onPress={() => setFilter('pending')} />
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="High priority" selected={filter === 'high_priority'} onPress={() => setFilter('high_priority')} />
          <Chip label="Completed" selected={filter === 'completed'} onPress={() => setFilter('completed')} />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => `${o.event.id}:${o.occurrenceDate}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          overdue.length > 0 && filter !== 'completed' ? (
            <View style={{ marginBottom: 8 }}>
              <SectionHeader title={`Overdue (${overdue.length})`} />
              <Card>
                {overdue.map((occ, i) => (
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
                    {i < overdue.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  </View>
                ))}
              </Card>
              <SectionHeader title="Tasks" />
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState emoji="📝" title="Nothing here" subtitle="Add a task to get organized." />}
        renderItem={({ item }) => (
          <Card style={styles.taskCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[styles.priorityBar, { backgroundColor: priorityColors[item.event.priority] }]}
              />
              <View style={{ flex: 1 }}>
                <EventListItem
                  occurrence={item}
                  showCountdown
                  onToggleComplete={() =>
                    useEventsStore.getState().toggleComplete(item.event.id, item.occurrenceDate)
                  }
                  onPress={() =>
                    nav.navigate('EventDetail', { eventId: item.event.id, occurrenceDate: item.occurrenceDate })
                  }
                />
              </View>
            </View>
          </Card>
        )}
      />
      <Pressable onPress={() => nav.navigate('AddEditEvent', { initialCategory: 'task' })} style={[styles.fab, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Add task">
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  taskCard: { marginBottom: 9, paddingVertical: 12, paddingHorizontal: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  priorityBar: { width: 4, height: '80%', borderRadius: 2, marginRight: 10 },
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
