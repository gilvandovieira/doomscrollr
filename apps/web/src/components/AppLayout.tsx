import { Outlet, useLocation } from "@tanstack/react-router";
import { type RefObject, useEffect, useRef } from "react";
import { HAS_CLERK, HAS_TEST_AUTH } from "../app/auth.ts";
import { useApplyAccountPreferences } from "../app/preferences.ts";
import { BottomNav } from "./BottomNav.tsx";
import { DiscoveryRail } from "./DiscoveryRail.tsx";
import { Header } from "./Header.tsx";
import { SideRail } from "./SideRail.tsx";
import { UsernameGate } from "./UsernameGate.tsx";

export function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // When signed in, apply theme/language saved to the account so it follows the user.
  useApplyAccountPreferences();
  useRouteFocus(pathname, mainRef);
  // The moderation console is a focused workbench, not a feed page: it drops the
  // discovery rails and uses the full width instead of the reading column.
  const isConsole = pathname.startsWith("/admin");

  return (
    <div className={`app-shell ${isConsole ? "app-shell--console" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      {!isConsole && <SideRail />}
      <main ref={mainRef} id="main-content" className="app-main" tabIndex={-1}>
        {(HAS_CLERK || HAS_TEST_AUTH) && <UsernameGate />}
        <PageTransitionOutlet />
      </main>
      {!isConsole && <DiscoveryRail />}
      <BottomNav />
    </div>
  );
}

function useRouteFocus(pathname: string, mainRef: RefObject<HTMLElement>) {
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    const frame = globalThis.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });

    return () => globalThis.cancelAnimationFrame(frame);
  }, [pathname, mainRef]);
}

function PageTransitionOutlet() {
  const location = useLocation();
  const motion = getRouteMotion(location.pathname);

  return (
    <div key={location.pathname} className={`route-transition route-transition--${motion}`}>
      <Outlet />
    </div>
  );
}

function getRouteMotion(pathname: string) {
  if (pathname === "/create") return "compose";
  if (pathname.startsWith("/tags")) return "tags";
  if (pathname.startsWith("/p/")) return "post";
  if (pathname.startsWith("/@")) return "profile";
  if (pathname.startsWith("/admin")) return "admin";
  return "feed";
}
