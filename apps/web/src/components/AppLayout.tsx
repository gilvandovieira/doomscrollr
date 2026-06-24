import { Outlet } from "@tanstack/react-router";
import { HAS_CLERK } from "../app/auth.ts";
import { Header } from "./Header.tsx";
import { UsernameGate } from "./UsernameGate.tsx";

export function AppLayout() {
  return (
    <div className="min-h-screen text-ink">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-3 pb-16 pt-4 sm:px-5">
        {HAS_CLERK && <UsernameGate />}
        <Outlet />
      </main>
    </div>
  );
}
