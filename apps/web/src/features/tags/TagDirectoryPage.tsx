import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchTags } from "../../app/api.ts";

export function TagDirectoryPage() {
  const { t } = useTranslation();
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
    staleTime: 120_000,
  });

  if (tagsQuery.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading tags">
        <div className="h-6 w-32 rounded-full bg-newsprint" />
        <div className="hard-panel h-40 animate-pulse bg-newsprint" />
      </div>
    );
  }

  if (tagsQuery.isError) {
    return (
      <div className="hard-panel p-5">
        <p className="meta-label text-oxide">{t("tagDir.unavailable")}</p>
        <p className="mt-2 text-sm font-bold">{t("tagDir.loadError")}</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <p className="meta-label">{t("tagDir.eyebrow")}</p>
        <h1 className="mobile-title">{t("tagDir.title")}</h1>
      </div>

      <div className="tag-directory">
        {tagsQuery.data.map((tag) => (
          <Link
            key={tag.slug}
            to="/tags/$tagSlug"
            params={{ tagSlug: tag.slug }}
            className="tag-directory__item hard-panel"
          >
            <span className="tag-directory__icon" aria-hidden="true">
              <Hash size={18} strokeWidth={2.4} />
            </span>
            <span className="tag-directory__main">
              <span className="tag-directory__name">{tag.displayName}</span>
              {tag.description && (
                <span className="tag-directory__description">{tag.description}</span>
              )}
            </span>
            <span className="tag-directory__count">
              {t("tagDir.posts", { count: tag.postCount })}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
