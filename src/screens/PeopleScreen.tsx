import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { usePeopleStore } from '@/store/peopleStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, EmptyState, Card } from '@/components/ui';

export default function PeopleScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const people = usePeopleStore((s) => s.people);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const all = Object.values(people).sort((a, b) => a.name.localeCompare(b.name));
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.relationship ?? '').toLowerCase().includes(q)
    );
  }, [people, query]);

  return (
    <ScreenContainer scroll={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.header, { color: colors.text }]}>People</Text>
          <Pressable onPress={() => nav.navigate('AddEditPerson', {})} style={[styles.headerAdd, { backgroundColor: colors.chipBg }]}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>
        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textFaint} />
          <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people..."
          placeholderTextColor={colors.textFaint}
          style={[styles.search, { color: colors.text }]}
          />
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState
            emoji={query.trim() ? '🔎' : '👤'}
            title={query.trim() ? 'No matching people' : 'No people yet'}
            subtitle={query.trim() ? 'Try a different name or relationship.' : 'Add someone to track their birthday and more.'}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.personCard} onPress={() => nav.navigate('PersonDetail', { personId: item.id })}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.avatar, { backgroundColor: '#EEE7FF' }]}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                {item.relationship ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 2 }}>
                    {item.relationship}
                  </Text>
                ) : null}
                {item.birthday ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 2 }}>
                    🎂 {new Date(2000, Number(item.birthday.slice(0, 2)) - 1, Number(item.birthday.slice(3, 5))).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                  </Text>
                ) : null}
              </View>
              {item.birthday ? <Text>🎂</Text> : null}
            </View>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 24, fontWeight: '800' },
  headerAdd: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { marginTop: 14, borderRadius: 15, paddingHorizontal: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  search: { flex: 1, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  personCard: { marginBottom: 10, padding: 14 },
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
