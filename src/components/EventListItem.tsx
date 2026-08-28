import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { EventOccurrence, EVENT_CATEGORIES } from '@/types';
import { useAppTheme } from '@/theme/ThemeContext';
import { categoryTint, priorityColors } from '@/theme/colors';
import { formatTime12h, countdownLabel, isPastMoment } from '@/lib/dateUtils';

function categoryMeta(category: string) {
  return EVENT_CATEGORIES.find((c) => c.key === category) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
}

export function EventListItem({
  occurrence,
  onPress,
  showCountdown = false,
  onToggleComplete,
}: {
  occurrence: EventOccurrence;
  onPress?: () => void;
  showCountdown?: boolean;
  onToggleComplete?: () => void;
}) {
  const { colors } = useAppTheme();
  const { event, occurrenceDate, isCompleted } = occurrence;
  const meta = categoryMeta(event.category);
  const tint = categoryTint[event.category] ?? colors.primary;
  const isOverdueTask = event.category === 'task' && !isCompleted && isPastMoment(occurrenceDate, event.time);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.iconBadge, { backgroundColor: tint + '22' }]}>
        <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: isOverdueTask ? colors.danger : colors.text, textDecorationLine: isCompleted ? 'line-through' : 'none' },
            ]}
          >
            {event.title}
          </Text>
          {event.priority === 'very_important' && <Text style={{ marginLeft: 6 }}>⭐</Text>}
        </View>
        <Text style={[styles.subtitle, { color: isOverdueTask ? colors.danger : colors.textMuted }]}> 
          {event.isAllDay ? 'All day' : formatTime12h(event.time)}
          {showCountdown ? `  ·  ${countdownLabel(occurrenceDate, event.time)}` : ''}
        </Text>
      </View>

      {onToggleComplete && (
        <Pressable
          onPress={onToggleComplete}
          hitSlop={10}
          style={[
            styles.checkbox,
            {
              borderColor: isCompleted ? colors.success : colors.border,
              backgroundColor: isCompleted ? colors.success : 'transparent',
            },
          ]}
        >
          {isCompleted && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
        </Pressable>
      )}

      {!onToggleComplete && (
        <View
          style={[styles.priorityDot, { backgroundColor: priorityColors[event.priority] }]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
});
