import type { PostKind } from "@doomscrollr/shared/types.ts";
import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { Hash, House } from "lucide-react";

// One filter per post type, each tagged with its kind color (the dot reads the
// shared --kind token, same palette as post pills and create tabs).
const KIND_FILTERS: { kind: PostKind; label: string }[] = [
  { kind: "text", label: "Text" },
  { kind: "external_image", label: "Images" },
  { kind: "youtube", label: "YouTube" },
  { kind: "repost", label: "Reposts" },
  { kind: "quote", label: "Quotes" },
];

// Desktop left rail: primary nav + filter-by-type. Hidden on mobile; the brand,
// theme, and auth live in the header, the bottom tab bar handles mobile nav, and
// discovery (popular tags / communities) lives in the right rail on wide screens.
export function SideRail() {
  const { pathname } = useLocation();
  // Loose read: SideRail is mounted on every route, so it can't bind to "/".
  const search = useSearch({ strict: false }) as { kind?: PostKind };
  const onFeed = pathname === "/";
  const activeKind = onFeed ? search.kind : undefined;

  const itemClass = (active: boolean) => active ? "rail-item rail-item--active" : "rail-item";

  return (
    <aside className="side-rail">
      <nav className="rail-nav" aria-label="Primary">
        <Link to="/" search={{}} className={itemClass(onFeed && !activeKind)}>
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

      <section className="rail-section" aria-label="Filter by post type">
        <p className="rail-eyebrow">Post types</p>
        <nav className="rail-nav">
          {KIND_FILTERS.map(({ kind, label }) => (
            <Link
              key={kind}
              to="/"
              search={{ kind }}
              data-kind={kind}
              className={itemClass(activeKind === kind)}
            >
              <span className="rail-item__dot" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </section>
    </aside>
  );
}
