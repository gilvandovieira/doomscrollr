import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "../components/AppLayout.tsx";
import { FeedPage } from "../features/feed/FeedPage.tsx";
import { ModerationPage } from "../features/moderation/ModerationPage.tsx";
import { PostDetailPage } from "../features/post/PostDetailPage.tsx";
import { ProfilePage } from "../features/profile/ProfilePage.tsx";
import { UploadPage } from "../features/upload/UploadPage.tsx";

function HotFeedRoute() {
  return <FeedPage sort="hot" />;
}

function RecentFeedRoute() {
  return <FeedPage sort="recent" />;
}

function TopFeedRoute() {
  return <FeedPage sort="top" />;
}

const rootRoute = createRootRoute({
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HotFeedRoute,
});

const recentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recent",
  component: RecentFeedRoute,
});

const topRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/top",
  component: TopFeedRoute,
});

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/post/$postId",
  component: PostDetailPage,
});

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/upload",
  component: UploadPage,
});

const moderationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/moderation",
  component: ModerationPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$username",
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  recentRoute,
  topRoute,
  postRoute,
  uploadRoute,
  moderationRoute,
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
