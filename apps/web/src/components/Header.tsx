import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, ChevronsDown, PenSquare, ShieldCheck } from "lucide-react";
import { fetchNotifications } from "../app/api.ts";
import { useAuthToken, useIsAdmin, useIsSignedIn } from "../app/account.ts";
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

  function scrollToTop() {
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;
    globalThis.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  // Tapping the logo on the feed: clear an active kind filter back to the full
  // feed, else scroll to top, else (already at the top) soft-refresh the feed (a
  // data refetch, not a full reload). From any other page, fall through so the
  // Link navigates home as usual.
  function onLogoClick(event: React.MouseEvent) {
    if (location.pathname !== "/") return;
    event.preventDefault();

    if ((location.search as { kind?: string }).kind) {
      void navigate({ to: "/", search: {} });
      scrollToTop();
      return;
    }
    if (globalThis.scrollY < 8) {
      void queryClient.invalidateQueries({ queryKey: ["feed", "recent"] });
      return;
    }
    scrollToTop();
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
        <AdminConsoleLink />

        <span className="top-chrome__theme">
          <ThemeToggle />
        </span>
        <AuthControls />
      </div>
    </header>
  );
}

// Only admins ever see this — gated on the server-verified role. The console
// itself and every /api/admin route enforce the role again, so a hidden link is
// a convenience, not the security boundary.
function AdminConsoleLink() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <Link
      to="/admin"
      className="icon-button icon-button--admin"
      aria-label="Moderation console"
      title="Moderation console"
      activeProps={{ className: "icon-button icon-button--admin is-active" }}
    >
      <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.35} />
    </Link>
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
