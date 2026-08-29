import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Alert, Share, Linking, Pressable } from 'react-native';
import * as Updates from 'expo-updates';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useEventsStore } from '@/store/eventsStore';
import { usePeopleStore } from '@/store/peopleStore';
import { useUpdateStore } from '@/store/updateStore';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Card, SectionHeader, Chip, SecondaryButton } from '@/components/ui';
import { ThemePreference } from '@/types';
import { exportAllData, deleteAllData } from '@/lib/storage';
import { requestPermissions, getPermissionState } from '@/lib/notifications';
import { logger } from '@/lib/logger';

export default function SettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const updateAvailable = useUpdateStore((s) => s.updateAvailable);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const dismissUpdate = useUpdateStore((s) => s.dismissUpdate);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);

  // Check for updates on screen load
  useEffect(() => {
    checkForUpdates().catch((e) => logger.warn('Failed to check updates:', e));
  }, []);

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

  const onCheckForUpdate = async () => {
    if (checkingForUpdate) return;
    setCheckingForUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('No update available', 'RememberMe is already up to date.');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'Restart RememberMe now to apply the update.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart', onPress: () => Updates.reloadAsync() },
      ]);
    } catch {
      Alert.alert(
        'Update unavailable',
        'Updates work in an installed APK configured with EAS Updates. Please try again after publishing an update.'
      );
    } finally {
      setCheckingForUpdate(false);
    }
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

      <SectionHeader title="App Updates" />
      {updateAvailable && latestVersion && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.accent || '#F59E0B' }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            🎉 Update Available!
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
            Version {latestVersion.version} is ready to download.
          </Text>
          {latestVersion.releaseNotes && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12, fontStyle: 'italic' }}>
              {latestVersion.releaseNotes}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={async () => {
                try {
                  if (latestVersion.downloadUrl) {
                    await Linking.openURL(latestVersion.downloadUrl);
                  }
                } catch (e) {
                  Alert.alert('Error', 'Failed to open download link');
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                paddingVertical: 10,
                borderRadius: 6,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Download</Text>
            </Pressable>
            <Pressable
              onPress={() => dismissUpdate()}
              style={{
                flex: 1,
                backgroundColor: colors.border,
                paddingVertical: 10,
                borderRadius: 6,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Later</Text>
            </Pressable>
          </View>
        </Card>
      )}
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          Download app changes without reinstalling the APK.
        </Text>
        <SecondaryButton
          title={checkingForUpdate ? 'Checking for updates...' : 'Check for Updates'}
          onPress={onCheckForUpdate}
        />
      </Card>

      <SectionHeader title="Quiet Hours" />
      <Card>
        <Row label="Enable quiet hours">
          <Switch
            value={settings.quietHoursEnabled}
            onValueChange={(v) => updateSettings({ quietHoursEnabled: v })}
          />
        </Row>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Start</Text>
            <TextInput
              value={settings.quietHoursStart}
              onChangeText={(value) => updateSettings({ quietHoursStart: value })}
              placeholder="22:00"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.text, padding: 10 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>End</Text>
            <TextInput
              value={settings.quietHoursEnd}
              onChangeText={(value) => updateSettings({ quietHoursEnd: value })}
              placeholder="07:00"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.text, padding: 10 }}
            />
          </View>
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
