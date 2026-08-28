import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Card, SectionHeader, PrimaryButton, EmptyState } from '@/components/ui';
import {
  scheduleTestNotification,
  getPermissionState,
  requestPermissions,
  getAllScheduledRecords,
  getNativeScheduledCount,
  PermissionState,
} from '@/lib/notifications';
import { ScheduledNotificationRecord } from '@/types';
import { formatDateShort } from '@/lib/dateUtils';

export default function NotificationTestScreen() {
  const { colors } = useAppTheme();
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [lastTestId, setLastTestId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [nativeCount, setNativeCount] = useState(0);
  const [records, setRecords] = useState<ScheduledNotificationRecord[]>([]);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    const state = await getPermissionState();
    setPermission(state);
    const list = await getAllScheduledRecords();
    setRecords(list);
    setScheduledCount(list.length);
    try {
      setNativeCount(await getNativeScheduledCount());
    } catch {
      // native count is best-effort diagnostic info only
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRequestPermission = async () => {
    setLastError(null);
    try {
      const state = await requestPermissions();
      setPermission(state);
    } catch (e: any) {
      setLastError(String(e?.message ?? e));
    }
  };

  const onSendTest = async () => {
    setSending(true);
    setLastError(null);
    try {
      const { id } = await scheduleTestNotification();
      setLastTestId(id);
      setTimeout(refresh, 500);
    } catch (e: any) {
      setLastError(String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  const next = records[0];

  return (
    <ScreenContainer contentContainerStyle={{ padding: 20 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>
        Developer tool — verify local notification scheduling on this device.
      </Text>

      <SectionHeader title="Permission Status" />
      <Card>
        <Text style={{ color: colors.text, fontSize: 15, marginBottom: 10 }}>
          Status: <Text style={{ fontWeight: '800', color: statusColor(permission, colors) }}>{permission}</Text>
        </Text>
        {permission !== 'granted' && <PrimaryButton title="Request Permission" onPress={onRequestPermission} />}
        {permission === 'denied' && (
          <Text style={{ color: colors.danger, fontSize: 12.5, marginTop: 10 }}>
            Permission was denied. Enable notifications from your device Settings → Apps → RememberMe →
            Notifications, then come back and press Request Permission again.
          </Text>
        )}
      </Card>

      <SectionHeader title="Test Notification" />
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          Sends "🔔 Test Reminder" about 10 seconds from now.
        </Text>
        <PrimaryButton title="Send Test Notification" onPress={onSendTest} loading={sending} />
        {lastTestId && (
          <Text style={{ color: colors.success, fontSize: 12.5, marginTop: 10 }}>
            Scheduled. Notification ID: {lastTestId}
          </Text>
        )}
        {lastError && (
          <Text style={{ color: colors.danger, fontSize: 12.5, marginTop: 10 }}>Error: {lastError}</Text>
        )}
      </Card>

      <SectionHeader
        title="Scheduled Notifications"
        right={
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            app: {scheduledCount} · native: {nativeCount}
          </Text>
        }
      />
      {next && (
        <Card style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Next scheduled</Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
            {formatDateShort(next.occurrenceDate)} · {new Date(next.triggerTimeIso).toLocaleTimeString()}
          </Text>
        </Card>
      )}
      <Card>
        {records.length === 0 ? (
          <EmptyState emoji="🔕" title="No notifications scheduled" />
        ) : (
          <FlatList
            data={records.slice(0, 20)}
            keyExtractor={(r) => r.key}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={{ color: colors.text, fontSize: 13 }}>
                  {item.eventId} · {formatDateShort(item.occurrenceDate)}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {new Date(item.triggerTimeIso).toLocaleString()}
                </Text>
              </View>
            )}
          />
        )}
      </Card>
    </ScreenContainer>
  );
}

function statusColor(state: PermissionState, colors: any): string {
  if (state === 'granted') return colors.success;
  if (state === 'denied') return colors.danger;
  return colors.textMuted;
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#0000001a' },
});
