import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { usePeopleStore } from '@/store/peopleStore';
import { useEventsStore } from '@/store/eventsStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Card, SectionHeader, SecondaryButton, EmptyState } from '@/components/ui';
import { EventListItem } from '@/components/EventListItem';
import { getNextOccurrence } from '@/lib/recurrence';

export default function PersonDetailScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PersonDetail'>>();
  const { colors } = useAppTheme();
  const person = usePeopleStore((s) => s.people[route.params.personId]);
  const events = useEventsStore((s) => s.events);

  if (!person) {
    return (
      <ScreenContainer contentContainerStyle={{ padding: 20 }}>
        <EmptyState emoji="👤" title="This person was removed" />
      </ScreenContainer>
    );
  }

  const linkedEvents = Object.values(events).filter((e) => e.personId === person.id);

  const onDelete = () => {
    Alert.alert('Delete this person?', 'Their birthday/anniversary reminders will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await usePeopleStore.getState().deletePerson(person.id);
          nav.goBack();
        },
      },
    ]);
  };

  return (
    <ScreenContainer contentContainerStyle={{ padding: 20 }}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>
            {person.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>
        {person.relationship ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{person.relationship}</Text>
        ) : null}
      </View>

      <Card style={{ marginTop: 16 }}>
        <InfoRow label="🎂 Birthday" value={monthDayLabel(person.birthday)} />
        <InfoRow label="💍 Anniversary" value={monthDayLabel(person.anniversary)} />
        {person.phoneNumber ? <InfoRow label="☎ Phone" value={person.phoneNumber} /> : null}
        {person.favoriteThings ? <InfoRow label="⭐ Favorite things" value={person.favoriteThings} /> : null}
        {person.notes ? <InfoRow label="📝 Notes" value={person.notes} /> : null}
      </Card>

      {linkedEvents.length > 0 && (
        <>
          <SectionHeader title="Upcoming for this person" />
          <Card>
            {linkedEvents.map((event, i) => {
              const next = getNextOccurrence(event, new Date());
              if (!next) return null;
              return (
                <View key={event.id}>
                  <EventListItem
                    occurrence={next}
                    showCountdown
                    onPress={() =>
                      nav.navigate('EventDetail', { eventId: event.id, occurrenceDate: next.occurrenceDate })
                    }
                  />
                  {i < linkedEvents.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              );
            })}
          </Card>
        </>
      )}

      <SecondaryButton title="Edit Person" onPress={() => nav.navigate('AddEditPerson', { personId: person.id })} style={{ marginTop: 24 }} />
      <SecondaryButton title="Delete Person" tone="danger" onPress={onDelete} style={{ marginTop: 10 }} />
    </ScreenContainer>
  );
}

function monthDayLabel(md: string | null | undefined): string {
  if (!md) return 'Not set';
  const [m, d] = md.split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
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

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800', marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
});
