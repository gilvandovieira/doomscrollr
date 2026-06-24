# Doomscrollr Roadmap: v1 -> v2 -> v3 -> Future Milestones

**Date:** 2026-06-24  
**Status:** canonical version ladder  
**Temporary project name:** Doomscrollr

> This roadmap is the only document that defines the version ladder. The active v1 implementation contract is `specs/doomscrollr_spec_v1.md`; if a v1 requirement conflicts with a roadmap summary, the v1 spec wins.

---

## 1. Product Bet

Doomscrollr starts as a small validation product, not as a full social platform.

The first hypothesis is:

```txt
Will people create posts, share them to WhatsApp, and get friends to open, react, comment, or create their own posts?
```

The core loop is:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

The governing rule is:

```txt
Earn every subsystem back with usage.
```

---

## 2. Version Ladder

### v1: Validation Product

v1 is a SFW-only, mobile-first product that tests the WhatsApp sharing loop.

Included:

```txt
Text posts
External image-link posts
YouTube/Shorts posts
Recent feed only
Canonical post URLs
Server-rendered Open Graph tags for /p/:postCode
WhatsApp share via canonical URL
Flat or shallow comments
Simple reactions/votes
@username profiles
Basic reporting/removal
User blocking
Basic rate limits
Optional curated tags only if trivial
```

Excluded:

```txt
BELL short links
DOOM uploads
GIPHY/Tenor
Ads and paid tier
Suggestive content surface
Mature/adult content
Age verification
Ranking runs
Deep Reddit comments
Communities/friend circles
Search
Notifications/mentions
Collections
Meme battles/remixes
Advanced analytics
```

Acceptance question:

```txt
Does the WhatsApp sharing loop create real engagement and return behavior?
```

---

### v2: Milestone After Usage

v2 is not automatic. It begins only if v1 shows real sharing and discussion behavior.

Likely v2 investments:

```txt
Better mobile/PWA polish
Improved curated tags and tag moderation
Notifications and mentions
Reposts / quote posts
More robust reports/admin queue
Redis-backed rate limits
One additional media provider, only if requested
BELL short links, only if canonical URLs are too long or attribution matters
Suggestive non-NSFW content surface, only after user controls and moderation are ready
Basic trust levels used internally for limits and review priority
```

Still excluded by default:

```txt
DOOM upload pipeline
Ads as a core model
Mature/adult content
Communities/friend circles
Full search
Deep analytics dashboards
Materialized ranking runs
```

Acceptance question:

```txt
Does v1 engagement deserve stronger retention, safety, and sharing infrastructure?
```

---

### v3: Platform Target

v3 is the broader platform target. It must be earned by usage from v1 and v2.

Potential v3 capabilities:

```txt
DOOM uploaded image/GIF subsystem
BELL sharing subsystem with short links and privacy-safe attribution
Advanced moderation workflows
Deeper discussion model if shallow comments become limiting
Search if tags/profiles are insufficient
Communities or friend circles, after deciding which model actually fits behavior
Reposts/quote posts as a core distribution mechanic
Generic monetization adapter if retention and moderation justify it
Improved profiles and identity surface
```

v3 target principles:

```txt
No mature/adult UGC by default.
No AdSense-specific core dependency.
No materialized ranking runs until feed volume proves need.
No ltree comments until subtree queries are proven necessary.
No provider zoo: add one provider at a time.
```

Acceptance question:

```txt
Has Doomscrollr proven enough retention, sharing, and moderation capacity to justify platform infrastructure?
```

---

## 3. Content Policy Roadmap

### v1

```txt
SFW-only.
Suggestive content is not shipped.
Mature/adult content is excluded.
```

### v2+

Suggestive content may be introduced only if there are real users, blocking, reporting, moderator capacity, and user controls.

```txt
Suggestive = non-explicit, non-nude, non-NSFW content that may need filtering.
```

### Out of Default Roadmap

```txt
Mature/adult UGC
Nudity
Pornography
Explicit sexual content
Age-gated NSFW feeds
Adult monetization
```

Mature/adult UGC is not a feature flag. It is a different business and requires a separate legal, payment, hosting, moderation, and compliance decision.

---

## 4. Earn-Back Backlog

Each future subsystem needs a trigger.

| Subsystem | Status | Earn-back trigger |
|---|---:|---|
| BELL short links | deferred | canonical URLs are too long or share attribution becomes essential |
| DOOM uploads | deferred | users need original image/GIF upload and external image links are insufficient |
| GIPHY/Tenor | deferred | users repeatedly ask for in-composer GIF search |
| Tags | optional v1 / stronger v2 | curated tags clearly improve discovery |
| Notifications/mentions | v2 candidate | reply/comment loops need return prompts |
| Reposts/quote posts | v2 candidate | users want to respond with posts instead of only comments |
| Trust levels | internal v2 candidate | abuse/quality requires different limits by account trust |
| Search | deferred | tags and profiles are insufficient |
| Communities/friend circles | deferred | behavior shows need for durable spaces; decide one, not both |
| Collections | deferred | users repeatedly save/share groups of posts |
| Share rooms | research pin | WhatsApp groups create recurring discussion around shared links |
| Remixes | research pin | users want to create variants of memes inside Doomscrollr |
| Meme battles | big future pin | two memes compete and users choose the funnier one |
| Analytics | very late | creators/mods need dashboards beyond validation events |
| Ads/monetization | late | retention and moderation are proven |
| Mature/adult UGC | out of roadmap | separate business/legal decision only |

---

## 5. Canonical Documents

```txt
specs/doomscrollr_spec_v1.md
specs/doomscrollr_spec_v2_milestone.md
specs/doomscrollr_spec_v3_target.md
specs/doomscrollr_future_milestones.md
```
