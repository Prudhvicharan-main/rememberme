import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

export function ScreenContainer({
  children,
  scroll = true,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  if (!scroll) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, contentContainerStyle]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[{ paddingBottom: 40 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, shadowColor: colors.shadow, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      {content}
    </Pressable>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>{title}</Text>
      {right}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  emoji,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.chipBg,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primaryText : colors.text }]}>
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: disabled ? colors.textFaint : colors.primary,
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryText} />
      ) : (
        <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  style,
  tone = 'default',
}: {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  tone?: 'default' | 'danger';
}) {
  const { colors } = useAppTheme();
  const color = tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { borderColor: color, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={[styles.secondaryButtonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.label, { color: colors.textMuted }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeader: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
