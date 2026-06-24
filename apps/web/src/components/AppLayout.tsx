import { Outlet } from "@tanstack/react-router";
import { HAS_CLERK, HAS_TEST_AUTH } from "../app/auth.ts";
import { BottomNav } from "./BottomNav.tsx";
import { DesignStyleSwitcher } from "./DesignStyleSwitcher.tsx";
import { Header } from "./Header.tsx";
import { UsernameGate } from "./UsernameGate.tsx";

export function AppLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <DesignStyleSwitcher />
        {(HAS_CLERK || HAS_TEST_AUTH) && <UsernameGate />}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
