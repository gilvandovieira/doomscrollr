import { useEffect } from "react";
import { useAccount, useAuthToken, useIsSignedIn } from "./account.ts";
import { saveAccountPreferences } from "./api.ts";
import { type Locale, setLocale } from "./i18n.ts";
import { setThemePref, type ThemePref } from "./theme.ts";

// Theme/language always apply on this device immediately. They are saved to the
// account ONLY when signed in, so the choice follows the user across devices; a
// signed-out user just keeps the device-local choice. A failed save never blocks
// the local change.
export function usePreferenceActions() {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();

  function changeTheme(pref: ThemePref) {
    setThemePref(pref);
    if (signedIn) void saveAccountPreferences({ themePreference: pref }, getToken).catch(() => {});
  }

  function changeLanguage(locale: Locale) {
    setLocale(locale);
    if (signedIn) void saveAccountPreferences({ locale }, getToken).catch(() => {});
  }

  return { changeTheme, changeLanguage, signedIn };
}

// On sign-in (account load), apply any saved preferences to this device. Applying
// is local-only (no save), so it never loops back into a write.
export function useApplyAccountPreferences() {
  const account = useAccount();
  const prefs = account.data?.preferences ?? null;
  const theme = prefs?.themePreference ?? null;
  const locale = prefs?.locale ?? null;

  useEffect(() => {
    if (theme) setThemePref(theme);
  }, [theme]);

  useEffect(() => {
    if (locale) setLocale(locale);
  }, [locale]);
}
