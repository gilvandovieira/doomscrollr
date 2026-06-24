# Doomscrollr Future Milestones and Research Pins

**Status:** deferred backlog / research map  
**Roadmap:** see `../doomscrollr_roadmap_v1_v2_v3_future.md`

---

## 1. Purpose

This file keeps future ideas visible without letting them pollute v1 scope.

The rule is:

```txt
A future idea is not a requirement until usage earns it.
```

---

## 2. Deferred Product Features

### Collections

Status: deferred.

Possible future:

```txt
Save posts
Private collections
Public collections
Share collection to WhatsApp
```

Earn-back trigger:

```txt
Users repeatedly ask to save or group posts.
```

---

### Notifications and Mentions

Status: v2 candidate.

Possible future:

```txt
reply notifications
comment-on-your-post notifications
@username mentions
moderation outcome notifications
```

Earn-back trigger:

```txt
Users comment enough that creators need return prompts.
```

---

### Reposts / Quote Posts

Status: v2 candidate.

Possible future:

```txt
repost
quote post with commentary
quote post with new media
```

Earn-back trigger:

```txt
Users want to respond to posts with their own posts, not only comments.
```

---

### Share Rooms

Status: research pin.

Idea:

```txt
A shared WhatsApp link can create or identify a temporary discussion room around a post.
```

Risk:

```txt
May confuse privacy expectations around WhatsApp groups.
```

Earn-back trigger:

```txt
Shared posts create recurring group-like discussion patterns.
```

---

### Remixes

Status: research pin.

Idea:

```txt
Caption image
Remix meme
Create variant from existing post
```

Earn-back trigger:

```txt
Users want to create new memes from posts they see.
```

---

### Meme Battles

Status: big future pin.

Idea:

```txt
Two meme posts compete.
Users vote which one is funnier.
Winner advances or gets highlighted.
```

Earn-back trigger:

```txt
The app has enough active meme posts and voting behavior to make battles fun.
```

---

### Search

Status: deferred.

Possible future:

```txt
post search
tag search
user search
comment search later
```

Earn-back trigger:

```txt
Tags, profiles, and recent feed are not enough for discovery.
```

---

### Communities or Friend Circles

Status: deferred strategic fork.

Do not build both by default.

```txt
Communities = public spaces.
Friend circles = private/semi-private groups.
```

Earn-back trigger:

```txt
Users need durable spaces beyond the global feed and tags.
```

---

### Strong Profiles

Status: deferred.

Possible future:

```txt
profile tabs
public collections
badges
community memberships
repost history
```

Earn-back trigger:

```txt
Identity and following behavior become important.
```

---

### Badges and Cosmetics

Status: interesting monetization candidate.

Possible future:

```txt
profile badges
custom profile themes
supporter marker
custom app icon for PWA later
```

Earn-back trigger:

```txt
retention exists and users care about identity expression.
```

---

### Analytics

Status: very late.

Possible future:

```txt
creator post stats
share stats
comment conversion
aggregated referrer stats
```

Rule:

```txt
Keep analytics privacy-safe and aggregate-first.
```

---

## 3. Deferred Technical Subsystems

### BELL

Short links and sharing attribution.

Not v1. Possibly v2 if canonical URLs are insufficient.

### DOOM

Uploaded image/GIF storage and optimization.

Not v1. Possibly v3 if users demand native uploads.

### Ranking Runs

Materialized ranked feeds.

Not v1/v2 by default. Earn only after volume proves need.

### Deep Comments

Use adjacency list first. Consider ltree only if real subtree queries justify it.

### Provider Expansion

Add providers one at a time. Do not add GIPHY and Tenor together.

---

## 4. Explicit Out-of-Product Area

Mature/adult UGC is outside the default roadmap.

```txt
No nudity.
No pornography.
No age-gated NSFW feed.
No adult paid tier.
No adult monetization.
```

Reconsidering this requires a separate business/legal/payment/hosting/compliance process.
