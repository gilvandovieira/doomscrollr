import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "../components/AppLayout.tsx";
import { AdminReportsPage } from "../features/admin/AdminReportsPage.tsx";
import { CreatePage } from "../features/create/CreatePage.tsx";
import { FeedPage } from "../features/feed/FeedPage.tsx";
import { PostDetailPage } from "../features/post/PostDetailPage.tsx";
import { ProfilePage } from "../features/profile/ProfilePage.tsx";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: FeedPage,
});

const createRouteDef = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create",
  component: CreatePage,
});

const adminReportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/reports",
  component: AdminReportsPage,
});

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/p/$postCode",
  component: PostDetailPage,
});

const postWithSlugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/p/$postCode/$slug",
  component: PostDetailPage,
});

// Profile handles carry the leading "@" in the param value, e.g. /@lucas (spec §6.3).
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$username",
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  createRouteDef,
  adminReportsRoute,
  postRoute,
  postWithSlugRoute,
  profileRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
