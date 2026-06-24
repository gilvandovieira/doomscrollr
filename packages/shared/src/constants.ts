export const PRODUCT_CODENAME = "Doomscrollr";

// Recent feed (the only feed in v1). The API may fetch 9 or 20 at a time; the
// product no longer needs the literal 3x3 homepage (spec §9).
export const DEFAULT_FEED_LIMIT = 20;
export const MAX_FEED_LIMIT = 50;

// Public codes use a URL-safe alphabet that avoids confusing characters (spec §7.2).
export const PUBLIC_CODE_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const PUBLIC_CODE_LENGTH = 10;

// Usernames: 3-24 chars, lowercase letters, numbers, underscore (spec §6.3).
export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

// Reserved handles that cannot be claimed by users (spec §6.3).
export const RESERVED_USERNAMES = [
  "admin",
  "api",
  "login",
  "logout",
  "settings",
  "support",
  "moderation",
  "doom",
  "scrollr",
  "bell",
  "doomscrollr",
  "p",
  "t",
  "about",
  "help",
  "terms",
  "privacy",
] as const;

// Post fields (spec §8.2).
export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 180;
export const POST_BODY_MAX_LENGTH = 10_000;

// Comment body (spec §8.3).
export const COMMENT_MIN_LENGTH = 1;
export const COMMENT_MAX_LENGTH = 2000;

// Curated tags (spec §8.7).
export const TAG_SLUG_REGEX = /^[a-z0-9-]{2,32}$/;
export const MAX_TAGS_PER_POST = 5;

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "nudity",
  "hate",
  "violent_content",
  "copyright_complaint",
  "misleading_title",
  "low_quality",
  "other",
] as const;

// Events fired by the client and accepted by POST /api/events (spec §10.2, §20.2).
export const CLIENT_EVENT_TYPES = [
  "post_opened",
  "whatsapp_share_clicked",
  "copy_link_clicked",
  "native_share_clicked",
] as const;

// Events emitted only server-side as a side effect of authenticated writes.
// These must be rejected if submitted to POST /api/events (spec §10.2).
export const SERVER_EVENT_TYPES = ["comment_created", "reaction_created"] as const;

export const ALL_EVENT_TYPES = [...CLIENT_EVENT_TYPES, ...SERVER_EVENT_TYPES] as const;
