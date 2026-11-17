/**
 * Nexora design tokens: the ONLY place where colors are written. Components use the Mantine theme (color "nexora")
 * or the CSS variables generated from these tokens (--nexora-*), never hexadecimal values.
 *
 * Official palette (white and burgundy). Contrast, WCAG 2.1 (checked by src/app/theme/contrast.test.ts):
 *  - white on burgundy #800020: 10.8:1 (AA, AAA); on burgundy dark #5C0018: 14.3:1
 *  - white on burgundy light #A63A56 (primary of the dark theme): 6.3:1 (AA)
 *  - secondary text #667085 on white: 5.0:1 (AA); on #F8F6F7: 4.6:1 (AA)
 */
export const palette = {
  burgundy: '#800020',
  burgundyDark: '#5C0018',
  burgundyLight: '#A63A56',
  white: '#FFFFFF',
  surfaceAlt: '#F8F6F7',
  textSecondary: '#667085',
  /** Derived tints and shades of the burgundy, for hover, selection and the dark theme. */
  burgundy50: '#FBF2F4',
  burgundy100: '#F3DDE2',
  burgundy200: '#E5B7C2',
  burgundy300: '#D58FA0',
  burgundy400: '#C26781',
  burgundy950: '#3D0010',
  /** Neutral text and lines. */
  text: '#1D1B20',
  border: '#E6E1E3',
  /** Dark theme surfaces. */
  darkBody: '#1A1417',
  darkSurface: '#241B1F',
  darkBorder: '#3A2D33',
  darkText: '#F3EEF0',
  darkTextSecondary: '#B8AEB3',
  /** Lifecycle states (pending = amber, inactive = neutral), readable on their backgrounds. */
  amber50: '#FFF4E5',
  amber800: '#8A4B00',
  amber950: '#3A2300',
  amber200: '#F5C77E',
  neutral100: '#F2F4F7',
  neutral600: '#475467',
  neutral800: '#2C2F36',
  neutral300: '#C9CDD4',
} as const;

/** Ten shades for Mantine (index 6 = the official burgundy, 8 = burgundy dark, 5 = burgundy light). */
export const nexoraShades = [
  palette.burgundy50,
  palette.burgundy100,
  palette.burgundy200,
  palette.burgundy300,
  palette.burgundy400,
  palette.burgundyLight,
  palette.burgundy,
  '#6E001C',
  palette.burgundyDark,
  palette.burgundy950,
] as const;

/** Semantic tokens per color scheme, exposed as CSS variables (--nexora-<name>). */
export const lightTokens = {
  'sidebar-bg': palette.burgundy,
  'sidebar-bg-active': palette.burgundyDark,
  'sidebar-text': palette.white,
  'sidebar-text-muted': palette.burgundy100,
  'body-bg': palette.white,
  'surface': palette.white,
  'surface-alt': palette.surfaceAlt,
  'border': palette.border,
  'text': palette.text,
  'text-secondary': palette.textSecondary,
  'accent': palette.burgundy,
  'accent-soft': palette.burgundy50,
  'user-bubble-bg': palette.burgundy,
  'user-bubble-text': palette.white,
  'nexora-bubble-bg': palette.surfaceAlt,
  'nexora-bubble-border': palette.border,
  'focus-ring': palette.burgundy,
  'status-draft-bg': palette.amber50,
  'status-draft-text': palette.amber800,
  'status-inactive-bg': palette.neutral100,
  'status-inactive-text': palette.neutral600,
} as const;

export const darkTokens: Record<keyof typeof lightTokens, string> = {
  'sidebar-bg': palette.burgundyDark,
  'sidebar-bg-active': palette.burgundy950,
  'sidebar-text': palette.white,
  'sidebar-text-muted': palette.burgundy200,
  'body-bg': palette.darkBody,
  'surface': palette.darkSurface,
  'surface-alt': palette.darkBody,
  'border': palette.darkBorder,
  'text': palette.darkText,
  'text-secondary': palette.darkTextSecondary,
  'accent': palette.burgundy300,
  'accent-soft': palette.burgundy950,
  'user-bubble-bg': palette.burgundyLight,
  'user-bubble-text': palette.white,
  'nexora-bubble-bg': palette.darkSurface,
  'nexora-bubble-border': palette.darkBorder,
  'focus-ring': palette.burgundy300,
  'status-draft-bg': palette.amber950,
  'status-draft-text': palette.amber200,
  'status-inactive-bg': palette.neutral800,
  'status-inactive-text': palette.neutral300,
};

export type TokenName = keyof typeof lightTokens;

/** The CSS variable of a token, for styles: `var(--nexora-sidebar-bg)`. */
export const token = (name: TokenName): string => `var(--nexora-${name})`;
