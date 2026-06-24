import type { FeedPost } from "@doomscrollr/shared/types.ts";

export function canShowAdsForPost(post: FeedPost) {
  return post.status === "published" &&
    post.monetizationStatus === "enabled" &&
    post.adSafetyScore >= 0.9;
}
