import { Link } from "@tanstack/react-router";
import { ChevronsDown } from "lucide-react";
import { AuthControls } from "./AuthControls.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

// Mobile top bar. Hidden on desktop (the rail takes over) via CSS.
export function Header() {
  return (
    <header className="top-chrome">
      <div className="top-chrome__inner">
        <Link to="/" className="brand-mark mr-auto" aria-label="Doomscrollr home">
          <span className="brand-mark__icon">
            <ChevronsDown aria-hidden="true" size={20} strokeWidth={2.75} />
          </span>
          <span className="brand-mark__word">Doomscrollr</span>
        </Link>

        <ThemeToggle />
        <AuthControls />
      </div>
    </header>
  );
}
