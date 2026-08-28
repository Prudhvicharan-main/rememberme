import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { usePeopleStore } from '@/store/peopleStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Label, PrimaryButton, SecondaryButton, Card } from '@/components/ui';

function monthDayToDate(md: string | null | undefined): Date {
  if (!md) return new Date();
  const [m, d] = md.split('-').map(Number);
  return new Date(2000, m - 1, d);
}
function dateToMonthDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatMonthDay(md: string | null | undefined): string {
  if (!md) return 'Not set';
  const d = monthDayToDate(md);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export default function AddEditPersonScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditPerson'>>();
  const { colors } = useAppTheme();
  const people = usePeopleStore((s) => s.people);
  const existing = route.params?.personId ? people[route.params.personId] : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [phoneNumber, setPhoneNumber] = useState(existing?.phoneNumber ?? '');
  const [birthday, setBirthday] = useState<string | null>(existing?.birthday ?? null);
  const [anniversary, setAnniversary] = useState<string | null>(existing?.anniversary ?? null);
  const [favoriteThings, setFavoriteThings] = useState(existing?.favoriteThings ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showBdayPicker, setShowBdayPicker] = useState(false);
  const [showAnnivPicker, setShowAnnivPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  const canSave = name.trim().length > 0;

  const onSave = async () => {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const input = { name: name.trim(), relationship, phoneNumber, birthday, anniversary, favoriteThings, notes };
      if (existing) {
        await usePeopleStore.getState().updatePerson(existing.id, input);
      } else {
        await usePeopleStore.getState().addPerson(input);
      }
      nav.goBack();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ padding: 20 }}>
      <Label>Name</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Rahul"
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <Label style={{ marginTop: 16 }}>Relationship</Label>
      <TextInput
        value={relationship}
        onChangeText={setRelationship}
        placeholder="e.g. Friend"
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <Label style={{ marginTop: 16 }}>Phone number (optional)</Label>
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="e.g. +91 98765 43210"
        placeholderTextColor={colors.textFaint}
        keyboardType="phone-pad"
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <Label style={{ marginTop: 16 }}>Birthday</Label>
      <Card onPress={() => setShowBdayPicker(true)}>
        <Text style={{ color: colors.text }}>🎂 {formatMonthDay(birthday)}</Text>
      </Card>
      {showBdayPicker && (
        <DateTimePicker
          value={monthDayToDate(birthday)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => {
            setShowBdayPicker(Platform.OS === 'ios');
            if (d) setBirthday(dateToMonthDay(d));
          }}
        />
      )}

      <Label style={{ marginTop: 16 }}>Anniversary (optional)</Label>
      <Card onPress={() => setShowAnnivPicker(true)}>
        <Text style={{ color: colors.text }}>💍 {formatMonthDay(anniversary)}</Text>
      </Card>
      {showAnnivPicker && (
        <DateTimePicker
          value={monthDayToDate(anniversary)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => {
            setShowAnnivPicker(Platform.OS === 'ios');
            if (d) setAnniversary(dateToMonthDay(d));
          }}
        />
      )}

      <Label style={{ marginTop: 16 }}>Favorite things</Label>
      <TextInput
        value={favoriteThings}
        onChangeText={setFavoriteThings}
        placeholder="e.g. Cricket, movies"
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <Label style={{ marginTop: 16 }}>Notes</Label>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Likes simple birthday wishes"
        placeholderTextColor={colors.textFaint}
        multiline
        style={[
          styles.input,
          { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, height: 90, textAlignVertical: 'top' },
        ]}
      />

      <PrimaryButton
        title={existing ? 'Save Changes' : 'Add Person'}
        onPress={onSave}
        disabled={!canSave}
        loading={saving}
        style={{ marginTop: 28 }}
      />
      <SecondaryButton title="Cancel" onPress={() => nav.goBack()} style={{ marginTop: 10 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
});
