# Doomscrollr v2 Milestone Specification

**Status:** milestone candidate, not automatic  
**Depends on:** v1 sharing-loop validation  
**Roadmap:** see `../doomscrollr_roadmap_v1_v2_v3_future.md`

---

## 1. Purpose

v2 exists only if v1 proves that people create posts, share them through WhatsApp, and return when friends react or comment.

v2 should strengthen retention, safety, and sharing without turning Doomscrollr into the old full platform prematurely.

The v2 rule is:

```txt
Keep the WhatsApp loop central.
Improve the parts that real usage proves are weak.
Do not add subsystems because they are architecturally interesting.
```

---

## 2. Product Focus

v2 likely focuses on:

```txt
Better mobile/PWA experience
Better tags
Notifications and mentions
Reposts / quote posts
Stronger moderation queue
Better rate limiting
Possible BELL short links
Possible suggestive non-NSFW content surface
Internal trust levels
```

v2 still avoids:

```txt
Mature/adult UGC
Age verification
AdSense-specific architecture
Full DOOM upload pipeline unless clearly earned
Materialized ranking runs
Communities/friend circles unless usage clearly demands them
```

---

## 3. Tags Become Stronger

If v1 tags are useful, v2 upgrades them from optional curated labels to a real discovery tool.

v2 tag features:

```txt
Curated tag directory
Tag pages
Admin tag creation/disable
Tag aliases / merges
Tag moderation on posts
Popular tags sidebar/screen
```

Still avoid free-form public tag creation by default.

Suggested tables:

```sql
CREATE TABLE tag_aliases (
  alias_slug text PRIMARY KEY,
  target_tag_id uuid NOT NULL REFERENCES tags(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Rules:

```txt
Max 5 tags per post.
Only active tags can be selected.
Admins can merge low-quality duplicates.
Blocked tags cannot be attached.
```

---

## 4. Notifications and Mentions

Notifications are a v2 candidate because they close the return loop.

Include:

```txt
reply to your post
reply to your comment
mention via @username
admin/moderation outcome
```

Start with in-app notifications only.

Defer:

```txt
Push notifications
Email digests
Notification preferences beyond basic mute controls
```

Mention rules:

```txt
Mentioned user must exist.
Blocked users cannot notify the blocker.
Rate-limit mentions to prevent spam.
```

---

## 5. Reposts / Quote Posts

Reposts and quote posts are useful but can amplify abuse. They should arrive only after v1 moderation and blocking feel solid.

Model:

```txt
quote_post:
  new post created by user
  references original_post_id
  has title/body or commentary
```

Rules:

```txt
Cannot quote removed posts.
Cannot quote posts by users who blocked you.
If original is removed, quote should show an unavailable reference.
```

---

## 6. BELL Candidate: Short Links

BELL remains optional in v2.

Earn it when canonical URLs are too long, WhatsApp attribution matters, or share behavior is frequent enough to justify short-link infrastructure.

BELL owns:

```txt
/s/:shortCode
short link creation
short link resolution
privacy-safe click events
WhatsApp link helpers
```

BELL must not become a generic public URL shortener.

Allowed targets:

```txt
Doomscrollr posts
Doomscrollr profiles
Future Doomscrollr comment threads
Future Doomscrollr communities
```

Forbidden:

```txt
arbitrary external URLs
phishing-style redirects
user-controlled open redirects
```

Fallback rule:

```txt
If BELL fails, canonical /p/:postCode URLs still work and sharing falls back to canonical URLs.
```

---

## 7. Moderation Upgrade

v2 should improve moderation if real users appear.

Add:

```txt
report queue filters
bulk dismiss/action
moderator notes
basic moderation audit log
user suspension/ban flow
post/comment restore history
```

Keep it proportionate. Do not build a full enterprise moderation console unless volume requires it.

---

## 8. Rate Limiting and Trust Levels

v1 can use simple rate limits. v2 should make limits more robust.

Use Redis or another shared store if the API can run multiple instances.

Trust levels should be internal at first:

```txt
new
normal
trusted
limited
moderator
admin
```

Trust affects:

```txt
post limits
comment limits
report weight
upload/provider validation limits
mention limits
tag suggestion ability
```

Do not expose trust as a public karma game in v2.

---

## 9. Suggestive Non-NSFW Surface

v2 may introduce suggestive content only after user controls and moderation are ready.

Doomscrollr distinction:

```txt
SFW = default-safe.
Suggestive = non-explicit, non-nude, non-NSFW content that may need filtering.
Mature/adult = excluded from Doomscrollr roadmap by default.
```

Possible v2 behavior:

```txt
Suggestive content is hidden from logged-out users.
Logged-in users can enable/disable suggestive content.
Suggestive content can be reported/reclassified/removed.
Suggestive content uses safe sharing previews if needed.
```

No age verification. No mature gate. No adult business logic.

---

## 10. PWA and Mobile Milestone

v2 may upgrade mobile polish:

```txt
installable manifest
app icons
better back/forward behavior
offline fallback page
cached static app shell
improved share UX
better touch interactions
```

Do not promise full offline feed behavior.

---

## 11. Explicitly Deferred From v2 Unless Usage Forces It

```txt
DOOM upload pipeline
GIPHY/Tenor provider zoo
full search
communities/friend circles
materialized ranking runs
ad monetization
mature/adult UGC
advanced analytics dashboards
```

---

## 12. v2 Exit Criteria

v2 is successful if it improves one or more proven v1 loops:

```txt
more shared posts opened
more comments/reactions from shared visitors
more creators returning after comments/reactions
more friends creating their own posts
less abuse per active user
faster moderation response
```
