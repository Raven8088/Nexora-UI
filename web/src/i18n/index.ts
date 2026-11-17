import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { es } from './locales/es';
import { en } from './locales/en';
import { fr } from './locales/fr';

export const LANGUAGES = ['es', 'en', 'fr'] as const;
export type UiLanguage = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'nexora.language';

function storedLanguage(): UiLanguage {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return (LANGUAGES as readonly string[]).includes(v ?? '') ? (v as UiLanguage) : 'es';
  } catch {
    return 'es';
  }
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en }, fr: { translation: fr } },
  lng: storedLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(language: UiLanguage): void {
  void i18n.changeLanguage(language);
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* preference only */
  }
}

/** The language sent to Intelligence (es, en or fr). */
export function requestLanguage(): UiLanguage {
  const l = i18n.language as UiLanguage;
  return (LANGUAGES as readonly string[]).includes(l) ? l : 'es';
}

export default i18n;
