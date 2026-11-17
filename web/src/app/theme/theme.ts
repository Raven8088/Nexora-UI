import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';
import { darkTokens, lightTokens, nexoraShades } from './tokens';

/** The Mantine theme of Nexora: burgundy primary color, quiet surfaces, burgundy focus. */
export const theme = createTheme({
  primaryColor: 'nexora',
  primaryShade: { light: 6, dark: 5 },
  colors: { nexora: [...nexoraShades] as unknown as MantineColorsTuple },
  fontFamily: 'Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: { fontWeight: '600' },
  defaultRadius: 'md',
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { radius: 'md', withBorder: true, shadow: 'xs' } },
    Paper: { defaultProps: { radius: 'md' } },
    TextInput: { defaultProps: { radius: 'md' } },
    Textarea: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
});

/**
 * Generates --nexora-* for both color schemes from the tokens. Mantine's «dimmed» color (help texts of inputs,
 * checkboxes and switches) is the secondary text token, which meets WCAG AA on every surface of the console
 * (contrast.test.ts); Mantine's own default did not (axe color-contrast on the dictionary forms, B3).
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { ...Object.fromEntries(Object.entries(lightTokens).map(([k, v]) => [`--nexora-${k}`, v])), '--mantine-color-dimmed': 'var(--nexora-text-secondary)' },
  dark: { ...Object.fromEntries(Object.entries(darkTokens).map(([k, v]) => [`--nexora-${k}`, v])), '--mantine-color-dimmed': 'var(--nexora-text-secondary)' },
});
