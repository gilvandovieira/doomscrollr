import { Link } from "@tanstack/react-router";
import { ChevronsDown, House, PenSquare } from "lucide-react";
import { AuthControls } from "./AuthControls.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

// Desktop left rail. Hidden on mobile (the top bar + bottom tabs take over) via CSS.
export function SideRail() {
  return (
    <aside className="side-rail">
      <Link to="/" className="brand-mark rail-brand" aria-label="Doomscrollr home">
        <span className="brand-mark__icon">
          <ChevronsDown aria-hidden="true" size={20} strokeWidth={2.75} />
        </span>
        <span className="brand-mark__word">Doomscrollr</span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className="rail-item"
          activeProps={{ className: "rail-item rail-item--active" }}
        >
          <House aria-hidden="true" size={20} strokeWidth={2.25} />
          Recent
        </Link>
        <Link
          to="/create"
          className="rail-item"
          activeProps={{ className: "rail-item rail-item--active" }}
        >
          <PenSquare aria-hidden="true" size={20} strokeWidth={2.25} />
          Create
        </Link>
      </nav>

      <div className="rail-foot">
        <ThemeToggle />
        <AuthControls />
      </div>
    </aside>
  );
}
