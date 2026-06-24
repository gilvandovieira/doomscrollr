import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, ChevronsDown, PenSquare } from "lucide-react";
import { fetchNotifications } from "../app/api.ts";
import { useAuthToken, useIsSignedIn } from "../app/account.ts";
import { AuthControls } from "./AuthControls.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

// App bar. On mobile it's the sticky top bar; on desktop it spans the top of the
// centered layout and carries the quick "New post" + auth actions.
export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showBack = location.pathname !== "/";

  function goBack() {
    if (globalThis.history.length > 1) {
      globalThis.history.back();
      return;
    }
    void navigate({ to: "/" });
  }

  // Tapping the logo on the feed: scroll to top; if already at the top, soft-refresh
  // the feed (a data refetch, not a full page reload). From any other page, fall
  // through so the Link navigates home as usual.
  function onLogoClick(event: React.MouseEvent) {
    if (location.pathname !== "/") return;
    event.preventDefault();
    if (globalThis.scrollY < 8) {
      void queryClient.invalidateQueries({ queryKey: ["feed", "recent"] });
      return;
    }
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    globalThis.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <header className={`top-chrome ${showBack ? "top-chrome--with-back" : ""}`}>
      <div className="top-chrome__inner">
        {showBack && (
          <button
            type="button"
            className="icon-button top-chrome__back"
            onClick={goBack}
            aria-label="Go back"
          >
            <ArrowLeft aria-hidden="true" size={19} strokeWidth={2.4} />
          </button>
        )}
        <Link
          to="/"
          className="brand-mark mr-auto"
          aria-label="Doomscrollr home"
          onClick={onLogoClick}
        >
          <span className="brand-mark__icon">
            <ChevronsDown aria-hidden="true" size={20} strokeWidth={2.75} />
          </span>
          <span className="brand-mark__word">Doomscrollr</span>
        </Link>

        <Link to="/create" className="tool-button bg-signal text-pitch top-chrome__create">
          <PenSquare aria-hidden="true" size={17} />
          <span className="top-chrome__create-label">New post</span>
        </Link>

        <NotificationsLink />

        <span className="top-chrome__theme">
          <ThemeToggle />
        </span>
        <AuthControls />
      </div>
    </header>
  );
}

function NotificationsLink() {
  const getToken = useAuthToken();
  const isSignedIn = useIsSignedIn();
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(getToken),
    enabled: isSignedIn,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!isSignedIn) return null;

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Link
      to="/notifications"
      className="icon-button notification-bell"
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
    >
      <Bell aria-hidden="true" size={18} strokeWidth={2.35} />
      {unreadCount > 0 && <span className="notification-bell__badge">{badgeLabel}</span>}
    </Link>
  );
}
