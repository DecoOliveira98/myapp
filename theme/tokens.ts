export type TokenSet = {
  // Backgrounds
  bgBase: string;
  bgWarm: string;
  surface1: string;
  surface2: string;
  surface3: string;
  trackBg: string;
  // Borders
  borderFaint: string;
  borderSoft: string;
  borderStrong: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textFaint: string;
  // Accent
  accent: string;
  accentSoft: string;
  accentDeep: string;
  accentText: string;
  accentBg: string;
  accentLine: string;
  onAccent: string;
  // Macro fills
  macroCarbs: string;
  macroFat: string;
  // Semantic
  danger: string;
  success: string;
  // Font families
  fontDisplay: string;
  fontDisplayItalic: string;
  fontBody: string;
  fontBodyMedium: string;
  fontBodySemiBold: string;
  fontMono: string;
  fontMonoMedium: string;
  // Spacing (px)
  sp1: number; sp2: number; sp3: number; sp4: number;
  sp5: number; sp6: number; sp7: number; sp8: number;
  sp9: number; sp10: number;
  // Border radius
  rSm: number; rMd: number; rLg: number; rPill: number;
  // Type scale (px)
  textXs: number; textSm: number; textBase: number; textMd: number;
  textLg: number; textXl: number; text2xl: number; text4xl: number;
  // Duration (ms)
  dFast: number; dBase: number;
};

const shared = {
  fontDisplay:       'Fraunces_300Light',
  fontDisplayItalic: 'Fraunces_300Light_Italic',
  fontBody:          'Geist_400Regular',
  fontBodyMedium:    'Geist_500Medium',
  fontBodySemiBold:  'Geist_600SemiBold',
  fontMono:          'GeistMono_400Regular',
  fontMonoMedium:    'GeistMono_500Medium',

  sp1: 4,  sp2: 8,  sp3: 12, sp4: 16,
  sp5: 24, sp6: 32, sp7: 48, sp8: 64,
  sp9: 88, sp10: 120,

  rSm: 2, rMd: 4, rLg: 8, rPill: 999,

  textXs:   11,
  textSm:   13,
  textBase: 15,
  textMd:   18,
  textLg:   22,
  textXl:   28,
  text2xl:  38,
  text4xl:  80,

  dFast: 180,
  dBase: 280,
};

export const tokensDark: TokenSet = {
  ...shared,

  bgBase:   '#0E0E10',
  bgWarm:   '#131012',
  surface1: '#17151A',
  surface2: '#1E1B20',
  surface3: '#26222B',
  trackBg:  '#17151A',

  borderFaint:  'rgba(245, 240, 232, 0.05)',
  borderSoft:   'rgba(245, 240, 232, 0.09)',
  borderStrong: 'rgba(245, 240, 232, 0.16)',

  textPrimary:   '#F5F0E8',
  textSecondary: '#9C948A',
  textTertiary:  '#5C564F',
  textFaint:     '#3A3631',

  accent:     '#F5B544',
  accentSoft: '#E9A547',
  accentDeep: '#8C5F1A',
  accentText: '#F5B544',
  accentBg:   'rgba(245, 181, 68, 0.10)',
  accentLine: 'rgba(245, 181, 68, 0.25)',
  onAccent:   '#0E0E10',

  macroCarbs: '#C9A878',
  macroFat:   '#6E5B43',

  danger:  '#E8836F',
  success: '#88C49C',
};

export const tokensLight: TokenSet = {
  ...shared,

  bgBase:   '#F5F1EB',
  bgWarm:   '#EEE8DF',
  surface1: '#FBF8F2',
  surface2: '#EFEAE0',
  surface3: '#E5DED2',
  trackBg:  '#D9CFC0',

  borderFaint:  'rgba(31, 27, 22, 0.05)',
  borderSoft:   'rgba(31, 27, 22, 0.08)',
  borderStrong: 'rgba(31, 27, 22, 0.16)',

  textPrimary:   '#1F1B16',
  textSecondary: '#6B6056',
  textTertiary:  '#9E9086',
  textFaint:     '#C4BCB3',

  accent:     '#F5B544',
  accentSoft: '#E9A547',
  accentDeep: '#8C5F1A',
  accentText: '#A8761A',
  accentBg:   'rgba(245, 181, 68, 0.12)',
  accentLine: 'rgba(168, 118, 26, 0.30)',
  onAccent:   '#1F1B16',

  macroCarbs: '#9E7438',
  macroFat:   '#6E5B43',

  danger:  '#D94F35',
  success: '#3A8055',
};

// Backwards-compat alias — screens not yet migrated to useTheme() stay dark
export const T = tokensDark;
