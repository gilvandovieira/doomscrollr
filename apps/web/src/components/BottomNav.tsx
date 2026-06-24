import { Link } from "@tanstack/react-router";
import { House, PenSquare } from "lucide-react";

// Mobile bottom tab bar. Hidden on desktop (the rail takes over) via CSS.
export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className="bottom-nav__item"
          activeProps={{ className: "bottom-nav__item bottom-nav__item--active" }}
        >
          <House aria-hidden="true" size={20} strokeWidth={2.25} />
          Recent
        </Link>
        <Link
          to="/create"
          className="bottom-nav__item"
          activeProps={{ className: "bottom-nav__item bottom-nav__item--active" }}
        >
          <PenSquare aria-hidden="true" size={20} strokeWidth={2.25} />
          Create
        </Link>
      </div>
    </nav>
  );
}
