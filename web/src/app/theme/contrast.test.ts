import { darkTokens, lightTokens, palette } from './tokens';

/** WCAG 2.1 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

describe('design tokens meet WCAG AA (4.5:1 for normal text)', () => {
  it.each([
    ['sidebar text on sidebar', lightTokens['sidebar-text'], lightTokens['sidebar-bg']],
    ['muted sidebar text on sidebar', lightTokens['sidebar-text-muted'], lightTokens['sidebar-bg']],
    ['text on body', lightTokens.text, lightTokens['body-bg']],
    ['secondary text on body', lightTokens['text-secondary'], lightTokens['body-bg']],
    ['secondary text on alternate surface', lightTokens['text-secondary'], lightTokens['surface-alt']],
    ['user bubble', lightTokens['user-bubble-text'], lightTokens['user-bubble-bg']],
    ['accent on soft accent', lightTokens.accent, lightTokens['accent-soft']],
    ['white on primary button', palette.white, palette.burgundy],
    ['dark: sidebar', darkTokens['sidebar-text'], darkTokens['sidebar-bg']],
    ['dark: text', darkTokens.text, darkTokens['body-bg']],
    ['dark: secondary text', darkTokens['text-secondary'], darkTokens.surface],
    ['dark: user bubble', darkTokens['user-bubble-text'], darkTokens['user-bubble-bg']],
    ['dark: accent', darkTokens.accent, darkTokens['body-bg']],
    ['dark: white on primary button (shade 5)', palette.white, palette.burgundyLight],
    ['draft badge', lightTokens['status-draft-text'], lightTokens['status-draft-bg']],
    ['inactive badge', lightTokens['status-inactive-text'], lightTokens['status-inactive-bg']],
    ['dark: draft badge', darkTokens['status-draft-text'], darkTokens['status-draft-bg']],
    ['dark: inactive badge', darkTokens['status-inactive-text'], darkTokens['status-inactive-bg']],
  ])('%s', (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
