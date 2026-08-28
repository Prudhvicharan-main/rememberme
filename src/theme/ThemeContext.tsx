import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, AppColors } from './colors';
import { useSettingsStore } from '@/store/settingsStore';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: lightColors, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((s) => s.settings.theme);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const value = useMemo<ThemeContextValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
