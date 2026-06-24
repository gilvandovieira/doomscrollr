import { Link } from "@tanstack/react-router";
import { Clock3, Flame, PenSquare } from "lucide-react";
import { AuthControls } from "./AuthControls.tsx";

const navLinkClass =
  "inline-flex h-10 items-center gap-2 border-2 border-ink bg-paper px-3 text-sm font-black uppercase text-ink transition hover:-translate-y-0.5 hover:bg-signal";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-3 py-3 sm:px-5">
        <Link
          to="/"
          className="mr-auto flex items-center gap-2 text-3xl font-black uppercase leading-none text-ink"
          aria-label="Doomscrollr home"
        >
          <span className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-oxide text-paper shadow-[3px_3px_0_#181512]">
            <Flame aria-hidden="true" size={22} strokeWidth={3} />
          </span>
          <span className="font-display">Doomscrollr</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2" aria-label="Primary navigation">
          <Link to="/" className={navLinkClass}>
            <Clock3 aria-hidden="true" size={16} strokeWidth={3} />
            <span className="hidden sm:inline">Recent</span>
          </Link>
          <Link to="/create" className="tool-button bg-signal" aria-label="Create post">
            <PenSquare aria-hidden="true" size={18} />
            <span className="hidden sm:inline">Create</span>
          </Link>
          <AuthControls />
        </nav>
      </div>
    </header>
  );
}
