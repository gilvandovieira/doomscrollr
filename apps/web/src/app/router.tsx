import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { PostKindSchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import type { PostKind } from "@doomscrollr/shared/types.ts";
import { AppLayout } from "../components/AppLayout.tsx";
import { FeedPage } from "../features/feed/FeedPage.tsx";

// The shell and the landing feed are eager (smallest path to first content on a
// cold load). Everything else is code-split so the feed isn't paying to download
// the create form, profile, admin, and post-detail/comment code it never uses.
const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // ?kind=… narrows the feed to one post type (sidebar filter). Anything else
  // (missing or unknown) means the unfiltered recent feed.
  validateSearch: (search: Record<string, unknown>): { kind?: PostKind } => {
    const result = PostKindSchema.safeParse(search.kind);
    return result.success ? { kind: result.data } : {};
  },
  component: FeedPage,
});

const createRouteDef = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create",
  component: lazyRouteComponent(() => import("../features/create/CreatePage.tsx"), "CreatePage"),
});

// The console splits into three surfaces: Moderation at /admin, History at
// /admin/history, and Administration (tag curation) at /admin/tags.
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: lazyRouteComponent(
    () => import("../features/admin/AdminReportsPage.tsx"),
    "AdminReportsPage",
  ),
});

const adminHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/history",
  component: lazyRouteComponent(
    () => import("../features/admin/AdminHistoryPage.tsx"),
    "AdminHistoryPage",
  ),
});

const adminTagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/tags",
  component: lazyRouteComponent(
    () => import("../features/admin/AdministrationPage.tsx"),
    "AdministrationPage",
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
  adminRoute,
  adminHistoryRoute,
  adminTagsRoute,
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
