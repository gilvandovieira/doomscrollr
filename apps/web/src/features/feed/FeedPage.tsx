import { getRouteApi } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InfinitePostList } from "./InfinitePostList.tsx";
import { useRecentFeed } from "./useFeedQuery.ts";

const route = getRouteApi("/");

export function FeedPage() {
  const { t } = useTranslation();
  const { kind } = route.useSearch();
  const feed = useRecentFeed(kind);
  const heading = kind ? t(`feed.heading.${kind}`) : t("feed.fresh");

  if (feed.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading feed">
        <div className="h-6 w-36 rounded-full bg-newsprint" />
        <div className="hard-panel h-56 animate-pulse bg-newsprint" />
        <div className="hard-panel h-44 animate-pulse bg-newsprint" />
      </div>
    );
  }

  if (feed.isError) {
    return (
      <div className="hard-panel p-5">
        <p className="meta-label text-oxide">{t("feed.unavailable")}</p>
        <p className="mt-2 text-sm font-bold">{t("feed.loadError")}</p>
      </div>
    );
  }

  const posts = feed.data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    return (
      <div className="hard-panel p-5">
        <h1 className="mobile-title">
          {kind ? t("feed.emptyKindTitle") : t("feed.emptyTitle")}
        </h1>
        <p className="mt-2 text-sm font-bold">
          {kind ? t("feed.emptyKindBody") : t("feed.emptyBody")}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <h1 className="mobile-title">{heading}</h1>
      </div>

      <InfinitePostList
        posts={posts}
        hasNextPage={feed.hasNextPage}
        isFetchingNextPage={feed.isFetchingNextPage}
        fetchNextPage={feed.fetchNextPage}
      />
    </section>
  );
}
