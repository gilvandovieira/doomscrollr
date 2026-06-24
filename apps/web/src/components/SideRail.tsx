import { Link } from "@tanstack/react-router";
import { Hash, House } from "lucide-react";

// Desktop left rail: primary nav. Hidden on mobile; the brand, theme, and auth
// live in the header, the bottom tab bar handles mobile nav, and discovery
// (popular tags / communities) lives in the right rail on wide screens.
export function SideRail() {
  return (
    <aside className="side-rail">
      <nav className="rail-nav" aria-label="Primary">
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
          to="/tags"
          className="rail-item"
          activeProps={{ className: "rail-item rail-item--active" }}
        >
          <Hash aria-hidden="true" size={20} strokeWidth={2.25} />
          Tags
        </Link>
      </nav>
    </aside>
  );
}
