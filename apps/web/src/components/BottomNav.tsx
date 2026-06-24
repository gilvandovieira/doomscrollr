import { Link } from "@tanstack/react-router";
import { Clock3, PenSquare } from "lucide-react";

const navItemClass = "bottom-nav__item";
const activeNavItemClass = "bottom-nav__item bottom-nav__item--active";

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <div className="bottom-nav__inner">
        <Link to="/" className={navItemClass} activeProps={{ className: activeNavItemClass }}>
          <Clock3 aria-hidden="true" size={18} strokeWidth={2.5} />
          Recent
        </Link>
        <Link
          to="/create"
          className={navItemClass}
          activeProps={{ className: activeNavItemClass }}
        >
          <PenSquare aria-hidden="true" size={18} strokeWidth={2.5} />
          Create
        </Link>
      </div>
    </nav>
  );
}
