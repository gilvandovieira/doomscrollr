import { Outlet, useLocation } from "@tanstack/react-router";
import { HAS_CLERK, HAS_TEST_AUTH } from "../app/auth.ts";
import { BottomNav } from "./BottomNav.tsx";
import { DiscoveryRail } from "./DiscoveryRail.tsx";
import { Header } from "./Header.tsx";
import { SideRail } from "./SideRail.tsx";
import { UsernameGate } from "./UsernameGate.tsx";

export function AppLayout() {
  return (
    <div className="app-shell">
      <Header />
      <SideRail />
      <main className="app-main">
        {(HAS_CLERK || HAS_TEST_AUTH) && <UsernameGate />}
        <PageTransitionOutlet />
      </main>
      <DiscoveryRail />
      <BottomNav />
    </div>
  );
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
