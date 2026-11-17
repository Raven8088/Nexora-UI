import type { Messages } from './es';

/** English: prepared, not translated yet (missing keys fall back to Spanish). */
export const en: DeepPartial<Messages> = {
  nav: { home: 'Home', chat: 'Nexora chat', dictionary: 'Semantic dictionary', settings: 'Settings' },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
