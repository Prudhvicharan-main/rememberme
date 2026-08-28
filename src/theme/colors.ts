export const palette = {
  violet: '#8B5CF6',
  violetDark: '#7C3AED',
  amber: '#F59E0B',
  rose: '#F43F5E',
  emerald: '#10B981',
  sky: '#0EA5E9',
};

export const lightColors = {
  background: '#F8F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EEFB',
  border: '#E7E3F5',
  text: '#1B1730',
  textMuted: '#6E6A85',
  textFaint: '#A6A2BE',
  primary: palette.violet,
  primaryText: '#FFFFFF',
  accent: palette.amber,
  danger: palette.rose,
  success: palette.emerald,
  info: palette.sky,
  chipBg: '#EFEAFB',
  shadow: 'rgba(60, 40, 120, 0.10)',
};

export const darkColors = {
  background: '#100E1C',
  surface: '#1B1830',
  surfaceAlt: '#241F3D',
  border: '#332D53',
  text: '#F3F1FA',
  textMuted: '#B5B0CE',
  textFaint: '#7C7796',
  primary: palette.violet,
  primaryText: '#FFFFFF',
  accent: palette.amber,
  danger: '#FB7185',
  success: '#34D399',
  info: '#38BDF8',
  chipBg: '#2A2447',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

export type AppColors = typeof lightColors;

export const priorityColors = {
  normal: palette.sky,
  important: palette.amber,
  very_important: palette.rose,
};

export const categoryTint: Record<string, string> = {
  birthday: '#F472B6',
  anniversary: '#FB7185',
  wedding: '#F59E0B',
  meeting: '#818CF8',
  task: '#34D399',
  college: '#38BDF8',
  work: '#A78BFA',
  payment: '#FBBF24',
  appointment: '#F87171',
  exam: '#60A5FA',
  event: '#C084FC',
  important: '#FB923C',
  custom: '#94A3B8',
};
