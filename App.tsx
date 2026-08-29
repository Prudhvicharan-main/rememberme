import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';

import { ThemeProvider, useAppTheme } from '@/theme/ThemeContext';
import { useAppBootstrap } from '@/lib/bootstrap';
import RootNavigator from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { registerReminderNotificationActions } from '@/lib/notifications';
import { useEventsStore } from '@/store/eventsStore';

function AppInner() {
  useEffect(() => {
    registerReminderNotificationActions().catch(() => undefined);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { eventId?: string; occurrenceDate?: string } | undefined;
      const eventId = data?.eventId;
      const occurrenceDate = data?.occurrenceDate;

      if (!eventId || !occurrenceDate) return;

      if (response.actionIdentifier === 'DONE_ACTION') {
        useEventsStore.getState().toggleComplete(eventId, occurrenceDate).catch(() => undefined);
      }

      if (response.actionIdentifier === 'SNOOZE_10M_ACTION') {
        const snoozeDate = new Date(Date.now() + 10 * 60 * 1000);
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Reminder snoozed',
            body: 'A quick reminder will appear again in 10 minutes.',
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: snoozeDate,
          },
        }).catch(() => undefined);
      }
    });

    return () => sub.remove();
  }, []);
  const ready = useAppBootstrap();
  const { colors, isDark } = useAppTheme();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
