export const T = {
  // Backgrounds
  bgBase:   '#0E0E10',
  bgWarm:   '#131012',
  surface1: '#17151A',
  surface2: '#1E1B20',
  surface3: '#26222B',

  // Borders
  borderFaint:  'rgba(245, 240, 232, 0.05)',
  borderSoft:   'rgba(245, 240, 232, 0.09)',
  borderStrong: 'rgba(245, 240, 232, 0.16)',

  // Text
  textPrimary:   '#F5F0E8',
  textSecondary: '#9C948A',
  textTertiary:  '#5C564F',
  textFaint:     '#3A3631',

  // Accent
  accent:     '#F5B544',
  accentSoft: '#E9A547',
  accentDeep: '#8C5F1A',
  accentBg:   'rgba(245, 181, 68, 0.10)',
  accentLine: 'rgba(245, 181, 68, 0.25)',

  // Semantic
  danger:  '#E8836F',
  success: '#88C49C',

  // Font families — match keys used in useFonts({ ... })
  fontDisplay:       'Fraunces_300Light',
  fontDisplayItalic: 'Fraunces_300Light_Italic',
  fontBody:          'Geist_400Regular',
  fontBodyMedium:    'Geist_500Medium',
  fontBodySemiBold:  'Geist_600SemiBold',
  fontMono:          'GeistMono_400Regular',
  fontMonoMedium:    'GeistMono_500Medium',

  // Spacing (px)
  sp1: 4,  sp2: 8,  sp3: 12, sp4: 16,
  sp5: 24, sp6: 32, sp7: 48, sp8: 64,
  sp9: 88, sp10: 120,

  // Border radius (refined, never round)
  rSm: 2, rMd: 4, rLg: 8, rPill: 999,

  // Type scale (px)
  textXs:   11,
  textSm:   13,
  textBase: 15,
  textMd:   18,
  textLg:   22,
  textXl:   28,
  text2xl:  38,
  text4xl:  80,  // hero calorie — adapted for mobile

  // Duration (ms)
  dFast: 180,
  dBase: 280,
} as const;
