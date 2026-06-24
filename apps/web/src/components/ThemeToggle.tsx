import { Monitor, Moon, Sun } from "lucide-react";
import { setThemePref, type ThemePref, useThemePref } from "../app/theme.ts";

const OPTIONS: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: "auto", label: "System theme", Icon: Monitor },
  { id: "light", label: "Light theme", Icon: Sun },
  { id: "dark", label: "Dark theme", Icon: Moon },
];

export function ThemeToggle() {
  const pref = useThemePref();

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="theme-toggle__btn"
          aria-pressed={pref === id}
          aria-label={label}
          title={label}
          onClick={() => setThemePref(id)}
        >
          <Icon aria-hidden="true" size={15} strokeWidth={2.25} />
        </button>
      ))}
    </div>
  );
}
