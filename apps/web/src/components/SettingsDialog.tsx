import { Monitor, Moon, Settings, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsSignedIn } from "../app/account.ts";
import { type Locale, SUPPORTED_LOCALES } from "../app/i18n.ts";
import { usePreferenceActions } from "../app/preferences.ts";
import { type ThemePref, useThemePref } from "../app/theme.ts";

// Header entry point: opens the settings dialog. Sign in / out lives in the header
// auth control, so this dialog is just appearance + language.
export function SettingsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={t("settings.open")}
        title={t("settings.open")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={18} strokeWidth={2.2} />
      </button>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const THEME_OPTIONS: { id: ThemePref; key: "system" | "light" | "dark"; Icon: typeof Sun }[] = [
  { id: "auto", key: "system", Icon: Monitor },
  { id: "light", key: "light", Icon: Sun },
  { id: "dark", key: "dark", Icon: Moon },
];

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t, i18n } = useTranslation();
  const themePref = useThemePref();
  const signedIn = useIsSignedIn();
  const { changeTheme, changeLanguage } = usePreferenceActions();
  const activeLocale = i18n.language as Locale;

  // Drive the native <dialog> from React state — it gives us focus trap, Esc, and
  // the top-layer backdrop for free.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(event) => {
        // Backdrop click: the dialog element fills the viewport, so a click landing
        // on it (not its inner card) is a click on the backdrop.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="settings-dialog__card">
        <header className="settings-dialog__head">
          <div>
            <h2 id="settings-title" className="settings-dialog__title">{t("settings.title")}</h2>
            <p className="settings-dialog__subtitle">{t("settings.subtitle")}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("settings.close")}
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <section className="settings-field">
          <span className="settings-field__label">{t("theme.label")}</span>
          <div className="settings-segment" role="group" aria-label={t("theme.label")}>
            {THEME_OPTIONS.map(({ id, key, Icon }) => (
              <button
                key={id}
                type="button"
                className="settings-segment__btn"
                aria-pressed={themePref === id}
                onClick={() => changeTheme(id)}
              >
                <Icon aria-hidden="true" size={15} strokeWidth={2.25} />
                {t(`theme.${key}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-field">
          <span className="settings-field__label">{t("language.label")}</span>
          <div className="settings-segment" role="group" aria-label={t("language.label")}>
            {SUPPORTED_LOCALES.map((locale) => (
              <button
                key={locale}
                type="button"
                className="settings-segment__btn"
                aria-pressed={activeLocale === locale}
                lang={locale}
                onClick={() => changeLanguage(locale)}
              >
                {t(`language.${locale}`)}
              </button>
            ))}
          </div>
        </section>

        <p className="settings-dialog__sync">
          {signedIn ? t("settings.syncOn") : t("settings.syncOff")}
        </p>
      </div>
    </dialog>
  );
}
