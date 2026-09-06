// Visual tokens. Light theme only by decision: the app is used in the kitchen and
// the household asked for a clean, bright look.
export const colors = {
  ground: '#F6F8F4',
  surface: '#FFFFFF',
  ink: '#1B231E',
  muted: '#59665E',
  accent: '#1F6B4A',
  accentInk: '#FFFFFF',
  accentSoft: '#DDEEE3',
  rule: '#D5DDD7',
  ruleStrong: '#B9C5BD',
  warn: '#8A5A0B',
  warnSoft: '#FBEFD9',
  danger: '#B3261E',
  dangerSoft: '#F9E3E1',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

// Typefaces, loaded in the root layout. Headings use Bricolage Grotesque, reading
// text IBM Plex Sans. Named font families carry their own weight, so fontWeight
// is not set alongside them (Android would fall back to the system face).
export const fonts = {
  heading: 'BricolageGrotesque_700Bold',
  headingMedium: 'BricolageGrotesque_500Medium',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemibold: 'IBMPlexSans_600SemiBold',
} as const;

export const type = {
  title: { fontFamily: fonts.heading, fontSize: 28, letterSpacing: -0.5, lineHeight: 30, color: colors.ink },
  heading: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: -0.2, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.ink, lineHeight: 22 },
  bodyMuted: { fontFamily: fonts.body, fontSize: 16, color: colors.muted, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' as const, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 },
} as const;

// Kitchen use: minimum comfortable tap target.
export const tapTarget = 48;

// Content column on wide screens (the website on a laptop). Phones are narrower than this.
export const maxContentWidth = 600;
