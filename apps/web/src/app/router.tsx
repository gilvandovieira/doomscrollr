import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { AppLayout } from "../components/AppLayout.tsx";
import { FeedPage } from "../features/feed/FeedPage.tsx";

// The shell and the landing feed are eager (smallest path to first content on a
// cold load). Everything else is code-split so the feed isn't paying to download
// the create form, profile, admin, and post-detail/comment code it never uses.
const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: FeedPage,
});

const createRouteDef = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create",
  component: lazyRouteComponent(() => import("../features/create/CreatePage.tsx"), "CreatePage"),
});

const adminReportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/reports",
  component: lazyRouteComponent(
    () => import("../features/admin/AdminReportsPage.tsx"),
    "AdminReportsPage",
  ),
});

const tagDirectoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  component: lazyRouteComponent(
    () => import("../features/tags/TagDirectoryPage.tsx"),
    "TagDirectoryPage",
  ),
});

const tagRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags/$tagSlug",
  component: lazyRouteComponent(() => import("../features/tags/TagPage.tsx"), "TagPage"),
});

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notifications",
  component: lazyRouteComponent(
    () => import("../features/notifications/NotificationsPage.tsx"),
    "NotificationsPage",
  ),
});

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/p/$postCode",
  component: lazyRouteComponent(
    () => import("../features/post/PostDetailPage.tsx"),
    "PostDetailPage",
  ),
});

const postWithSlugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/p/$postCode/$slug",
  component: lazyRouteComponent(
    () => import("../features/post/PostDetailPage.tsx"),
    "PostDetailPage",
  ),
});

// Profile handles carry the leading "@" in the param value, e.g. /@lucas (spec §6.3).
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$username",
  component: lazyRouteComponent(() => import("../features/profile/ProfilePage.tsx"), "ProfilePage"),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  createRouteDef,
  adminReportsRoute,
  tagDirectoryRoute,
  tagRoute,
  notificationsRoute,
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
