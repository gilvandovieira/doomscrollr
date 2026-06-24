import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en.ts";
import { ptBR } from "./locales/pt-BR.ts";

// Display-language setup. The active language drives UI copy (via useTranslation)
// and locale-aware Intl formatting (see ./format.ts). User-generated content is
// never translated — only the app's own chrome. Persistence: localStorage on this
// device, and the user's profile when signed in (see account preferences sync).

export const SUPPORTED_LOCALES = ["en", "pt-BR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const STORAGE_KEY = "doomscrollr.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Precedence: explicit device choice -> browser language -> default.
function detectInitialLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  }
  const nav = typeof navigator !== "undefined" ? navigator.language?.toLowerCase() ?? "" : "";
  if (nav.startsWith("pt")) return "pt-BR";
  return DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources: {
    "en": { translation: en },
    "pt-BR": { translation: ptBR },
  },
  lng: detectInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false }, // React already escapes.
  returnNull: false,
  // Resources are bundled inline, so nothing loads async — no Suspense needed.
  react: { useSuspense: false },
});

syncDocumentLang(i18n.language);

function syncDocumentLang(locale: string): void {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

// Apply a locale to this device (localStorage + <html lang> + live UI). Persisting
// to the signed-in profile is the caller's job — keep this side-effect-local so
// the profile-sync hook can apply server values without a save loop.
export function setLocale(locale: Locale): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
  syncDocumentLang(locale);
}

i18n.on("languageChanged", syncDocumentLang);

export default i18n;
