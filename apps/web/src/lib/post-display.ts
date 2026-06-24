import type { FeedPost } from "@doomscrollr/shared/types.ts";
import type { TFunction } from "i18next";

type PostLike = Pick<FeedPost, "postKind" | "title" | "repostOf">;

export function cleanReshareTitle(title: string): string {
  const clean = title.replace(/^(?:(?:Repost|Quote):\s*)+/i, "").trim();
  return clean || title;
}

export function postDisplayTitle(post: PostLike): string {
  if ((post.postKind === "repost" || post.postKind === "quote") && post.repostOf) {
    return cleanReshareTitle(post.repostOf.title);
  }
  return cleanReshareTitle(post.title);
}

// The server stores this exact title when a YouTube post has no derivable title
// (resolveYouTubeTitle fallback). It's a system string, not user content, so we
// localize it at display time. Keep in sync with the API fallback.
const SERVER_FALLBACK_TITLE = "Shared video";

export function localizeFallbackTitle(title: string, t: TFunction): string {
  return title === SERVER_FALLBACK_TITLE ? t("post.untitledVideo") : title;
}

export function postKindLabel(kind: FeedPost["postKind"], t: TFunction): string {
  return t(`post.kind.${kind}`);
}

export function sourceKindLabel(kind: FeedPost["postKind"], t: TFunction): string {
  if (kind === "external_image" || kind === "youtube" || kind === "text") {
    return t(`post.source.${kind}`);
  }
  return t("post.source.other");
}
