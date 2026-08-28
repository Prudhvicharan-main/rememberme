import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useEventsStore } from '@/store/eventsStore';
import { usePeopleStore } from '@/store/peopleStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Card, SectionHeader, Chip, SecondaryButton } from '@/components/ui';
import { ThemePreference } from '@/types';
import { exportAllData, deleteAllData } from '@/lib/storage';
import { requestPermissions, getPermissionState } from '@/lib/notifications';

export default function SettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);

  const onToggleNotifications = async (value: boolean) => {
    if (value) {
      const state = await requestPermissions();
      if (state !== 'granted') {
        setPermissionNote(
          state === 'denied'
            ? 'Notifications are blocked in your device settings. Enable them from Settings → Apps → RememberMe → Notifications.'
            : 'Permission was not granted, so reminders will stay silent until you allow notifications.'
        );
        await updateSettings({ notificationsEnabled: false });
        return;
      }
    }
    setPermissionNote(null);
    await updateSettings({ notificationsEnabled: value });
  };

  const onExport = async () => {
    const json = await exportAllData();
    await Share.share({ message: json, title: 'RememberMe data export' });
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete all data?',
      'This removes every event, person, and setting from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await deleteAllData();
            useEventsStore.setState({ events: {} });
            usePeopleStore.setState({ people: {} });
            await useSettingsStore.getState().load();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer contentContainerStyle={{ padding: 20 }}>
      <SectionHeader title="Notifications" />
      <Card>
        <Row label="Enable notifications">
          <Switch value={settings.notificationsEnabled} onValueChange={onToggleNotifications} />
        </Row>
        {permissionNote && (
          <Text style={{ color: colors.danger, fontSize: 12.5, marginTop: 8 }}>{permissionNote}</Text>
        )}
      </Card>
      <SecondaryButton title="Notification Testing Tools" onPress={() => nav.navigate('NotificationTest')} style={{ marginTop: 12 }} />

      <SectionHeader title="Appearance" />
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 12.5, marginBottom: 10 }}>Theme</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(['light', 'dark', 'system'] as ThemePreference[]).map((t) => (
            <Chip
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              selected={settings.theme === t}
              onPress={() => updateSettings({ theme: t })}
            />
          ))}
        </View>
      </Card>

      <SectionHeader title="Morning Briefing" />
      <Card>
        <Row label="Show morning briefing on Home">
          <Switch
            value={settings.morningBriefingEnabled}
            onValueChange={(v) => updateSettings({ morningBriefingEnabled: v })}
          />
        </Row>
      </Card>

      <SectionHeader title="Account & Data" />
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          All your data is stored privately on this device only — nothing is uploaded or shared by
          default.
        </Text>
        <SecondaryButton title="Export My Data" onPress={onExport} />
        <SecondaryButton title="Delete All Data" tone="danger" onPress={onDeleteAll} style={{ marginTop: 10 }} />
      </Card>
    </ScreenContainer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({});
