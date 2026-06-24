import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { AuthControls } from "./AuthControls.tsx";

export function Header() {
  return (
    <header className="top-chrome">
      <div className="top-chrome__inner">
        <Link
          to="/"
          className="brand-mark mr-auto"
          aria-label="Doomscrollr home"
        >
          <span className="brand-mark__icon">
            <Flame aria-hidden="true" size={22} strokeWidth={3} />
          </span>
          <span className="brand-mark__word">Doomscrollr</span>
        </Link>

        <AuthControls />
      </div>
    </header>
  );
}
