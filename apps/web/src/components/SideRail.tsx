import type { PostKind } from "@doomscrollr/shared/types.ts";
import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { Hash, House } from "lucide-react";
import { useTranslation } from "react-i18next";

// One filter per post type, each tagged with its kind color (the dot reads the
// shared --kind token, same palette as post pills and create tabs). Labels come
// from the `kinds.*` catalog keyed by the post kind.
const KIND_FILTERS: PostKind[] = ["text", "external_image", "youtube", "repost", "quote"];

// Desktop left rail: primary nav + filter-by-type. Hidden on mobile; the brand,
// theme, and auth live in the header, the bottom tab bar handles mobile nav, and
// discovery (popular tags / communities) lives in the right rail on wide screens.
export function SideRail() {
  const { t } = useTranslation();
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
          {t("nav.recent")}
        </Link>
        <Link
          to="/tags"
          className="rail-item"
          activeProps={{ className: "rail-item rail-item--active" }}
        >
          <Hash aria-hidden="true" size={20} strokeWidth={2.25} />
          {t("nav.tags")}
        </Link>
      </nav>

      <section className="rail-section" aria-label="Filter by post type">
        <p className="rail-eyebrow">{t("nav.postTypes")}</p>
        <nav className="rail-nav">
          {KIND_FILTERS.map((kind) => (
            <Link
              key={kind}
              to="/"
              search={{ kind }}
              data-kind={kind}
              className={itemClass(activeKind === kind)}
            >
              <span className="rail-item__dot" aria-hidden="true" />
              {t(`kinds.${kind}`)}
            </Link>
          ))}
        </nav>
      </section>
    </aside>
  );
}
