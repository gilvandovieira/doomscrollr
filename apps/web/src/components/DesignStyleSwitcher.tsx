import { Palette } from "lucide-react";
import { useEffect, useState } from "react";

type DesignStyle = "clash" | "relay" | "night";

const STORAGE_KEY = "doomscrollr.designStyle";

const STYLE_OPTIONS: { id: DesignStyle; label: string; themeColor: string }[] = [
  { id: "clash", label: "Clash", themeColor: "#f1f7f8" },
  { id: "relay", label: "Relay", themeColor: "#edf8ef" },
  { id: "night", label: "Night", themeColor: "#171326" },
];

function isDesignStyle(value: string | null): value is DesignStyle {
  return STYLE_OPTIONS.some((option) => option.id === value);
}

function readInitialStyle(): DesignStyle {
  if (typeof globalThis.localStorage === "undefined") return "clash";
  const stored = globalThis.localStorage.getItem(STORAGE_KEY);
  return isDesignStyle(stored) ? stored : "clash";
}

export function DesignStyleSwitcher() {
  const [style, setStyle] = useState<DesignStyle>(readInitialStyle);

  useEffect(() => {
    document.documentElement.dataset.designStyle = style;
    globalThis.localStorage.setItem(STORAGE_KEY, style);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      STYLE_OPTIONS.find((option) => option.id === style)?.themeColor ?? "#f1f7f8",
    );
  }, [style]);

  return (
    <div className="style-dock" role="group" aria-label="Design style">
      {STYLE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="style-dock__button"
          aria-pressed={style === option.id}
          onClick={() => setStyle(option.id)}
        >
          <span className="inline-flex items-center justify-center gap-1">
            {style === option.id && <Palette aria-hidden="true" size={13} />}
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
