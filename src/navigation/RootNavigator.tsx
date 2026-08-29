import React from 'react';
import { Pressable } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList, TabParamList } from './types';
import { useAppTheme } from '@/theme/ThemeContext';

import HomeScreen from '@/screens/HomeScreen';
import CalendarScreen from '@/screens/CalendarScreen';
import MomentsScreen from '@/screens/MomentsScreen';
import MeetingsScreen from '@/screens/MeetingsScreen';
import PeopleScreen from '@/screens/PeopleScreen';
import TasksScreen from '@/screens/TasksScreen';
import AssistantScreen from '@/screens/AssistantScreen';
import AddEditEventScreen from '@/screens/AddEditEventScreen';
import EventDetailScreen from '@/screens/EventDetailScreen';
import AddEditPersonScreen from '@/screens/AddEditPersonScreen';
import PersonDetailScreen from '@/screens/PersonDetailScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import NotificationTestScreen from '@/screens/NotificationTestScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Moments: 'sparkles',
  Meetings: 'calendar',
  People: 'people',
  Tasks: 'checkbox',
  Assistant: 'chatbubble-ellipses',
};

function SettingsButton() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={() => nav.navigate('Settings')} hitSlop={12} style={{ paddingRight: 4 }}>
      <Ionicons name="settings-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

function Tabs() {
  const { colors } = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '800' as const },
        headerRight: () => <SettingsButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name as keyof TabParamList]} size={size - 2} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'RememberMe' }} />
      <Tab.Screen name="Moments" component={MomentsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Meetings" component={MeetingsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="People" component={PeopleScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Assistant" component={AssistantScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { colors, isDark } = useAppTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text, fontWeight: '800' as const },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Assistant" component={AssistantScreen} options={{ title: 'Assistant' }} />
        <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
        <Stack.Screen
          name="AddEditEvent"
          component={AddEditEventScreen}
          options={{ title: 'Add Event', presentation: 'modal' }}
        />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
        <Stack.Screen
          name="AddEditPerson"
          component={AddEditPersonScreen}
          options={{ title: 'Person', presentation: 'modal' }}
        />
        <Stack.Screen name="PersonDetail" component={PersonDetailScreen} options={{ title: 'Person' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen
          name="NotificationTest"
          component={NotificationTestScreen}
          options={{ title: 'Notification Testing' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
