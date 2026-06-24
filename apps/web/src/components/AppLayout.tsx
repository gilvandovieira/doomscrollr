import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header.tsx";

export function AppLayout() {
  return (
    <div className="min-h-screen text-ink">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-3 pb-16 pt-4 sm:px-5 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
