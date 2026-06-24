# Doomscrollr v3 Target Specification

**Status:** target architecture / earned platform direction  
**Depends on:** v1 validation and v2 milestone usage  
**Roadmap:** see `../doomscrollr_roadmap_v1_v2_v3_future.md`

---

## 1. Purpose

v3 is the broader platform target that Doomscrollr may move toward if v1 and v2 prove real usage.

This document is not a release checklist. It is a target capability map.

The v3 rule is:

```txt
Platform infrastructure must be earned by measured usage.
```

---

## 2. Core Product Identity

Doomscrollr remains a mobile-first social posting app centered on sharing and discussion.

The core loop is still:

```txt
Create post -> Share -> Friend opens -> Friend interacts -> Creator returns
```

v3 expands the surface only if the loop is proven.

---

## 3. Scrollr System

Scrollr is the core product system.

Scrollr owns:

```txt
users
@username profiles
posts
feeds
comments
reactions/votes
reports
blocking
moderation
public routes
tags
provider posts
sharing integration
```

Scrollr must keep canonical URLs independent from optional subsystems.

Canonical URLs:

```txt
/p/:postCode
/p/:postCode/:slug
/@:username
/t/:tagSlug
```

---

## 4. Post Model Direction

v3 may support more post kinds than v1.

Likely post kinds:

```txt
text
external_image
youtube
link
provider_gif
uploaded_image
uploaded_gif
quote
```

But the simplest valid model remains:

```txt
Post = discussion object.
Media = optional attachment/source.
```

If media complexity grows, reintroduce a `media_assets` abstraction. If it does, document per-source state machines so YouTube/GIPHY/DOOM do not share nonsensical lifecycle states.

---

## 5. Comments Direction

v3 may deepen discussion, but should not jump to ltree automatically.

Preferred progression:

```txt
v1: flat or shallow adjacency comments
v2: shallow replies plus better notification/mention loops
v3: deeper adjacency list if users need it
later: ltree/materialized path only if subtree queries are proven necessary
```

Do not introduce ltree solely because it is elegant. Use it only when real query patterns require subtree traversal.

---

## 6. BELL Target: Sharing Subsystem

BELL may become the short-link and share-attribution subsystem.

BELL owns:

```txt
/s/:shortCode
short link creation
short link resolution
WhatsApp share helpers
privacy-safe share/click events
optional QR links
```

BELL does not own:

```txt
post visibility
moderation decisions
content policy
canonical URLs
```

Rules:

```txt
BELL only links to internal Doomscrollr resources.
BELL must never be a generic URL shortener.
If BELL is down, canonical Scrollr URLs still work.
```

---

## 7. DOOM Target: Uploaded Image/GIF Subsystem

DOOM may become the uploaded media subsystem after users prove they need native uploads.

DOOM owns:

```txt
multipart image/GIF upload
S3-compatible object storage
RustFS for local development
image/GIF validation
optimization variants
media worker
cleanup jobs
```

DOOM does not own:

```txt
posts
feeds
comments
votes
moderation policy
YouTube/GIPHY/external provider posts
```

Failure rule:

```txt
If DOOM is down, new uploads fail, but text posts, YouTube posts, external image links, comments, and feeds still work.
```

No native video upload by default.

---

## 8. Provider Strategy

Do not integrate a provider zoo.

Provider policy:

```txt
Start with YouTube/Shorts.
Add one provider at a time only when usage proves demand.
Do not add GIPHY and Tenor together.
Prefer reactive failure handling over proactive forever re-check jobs until scale demands otherwise.
```

If GIF search becomes needed, pick one provider first.

---

## 9. Feed and Ranking Strategy

v3 may need stronger ranking, but materialized ranking runs are not default.

Progression:

```txt
v1: recent feed only, keyset pagination
v2: cheap hot query if needed
v3: materialized ranking runs only if naive ranking is measurably slow or wrong
```

If materialized ranking runs are introduced:

```txt
materialize lazily/on-demand for active surfaces
do not precompute the whole long tail
do not duplicate runs for unused tags
keep cursor behavior stable
```

---

## 10. Tags, Search, and Discovery

v3 may include:

```txt
strong curated tags
tag aliases/merges
popular tags
search
profile discovery
```

Search is deferred until tags/profiles are insufficient.

---

## 11. Communities or Friend Circles

Communities and friend circles are overlapping ideas.

v3 should not build both blindly.

Decision fork:

```txt
Communities = public durable spaces around topics.
Friend circles = private/semi-private sharing groups.
```

Choose based on user behavior.

---

## 12. Moderation Target

v3 may need stronger moderation:

```txt
report queue
moderator notes
audit logs
restore history
user suspension/ban flows
content reclassification
blocked tags/domains
trusted-user review priority
```

Moderation must stay proportionate to usage volume.

---

## 13. Content Policy Target

Doomscrollr's default roadmap is not an adult/mature UGC business.

Allowed roadmap:

```txt
SFW
Suggestive non-NSFW, only when user controls and moderation are ready
```

Excluded by default:

```txt
mature/adult UGC
nudity
pornography
explicit sexual content
age-gated NSFW feeds
adult monetization
```

Any future mature/adult support requires a separate business/legal/payment/hosting/compliance decision and a separate spec.

---

## 14. Monetization Target

Do not make AdSense a design dependency.

If monetization arrives, use a generic adapter model:

```txt
none
direct sponsorship
internal promo
paid UX perks
ad network provider, if approved
```

Ads must not shape the v1/v2 core model.

Paid tier candidates:

```txt
ad-free if ads exist
cosmetics
profile badges
advanced filters
higher limits
saved items/collections later
```

Do not monetize NSFW access.

---

## 15. Future Platform Acceptance Principles

A v3 subsystem is accepted only if:

```txt
it solves a measured problem
it has a fallback/degradation story
it does not make canonical post viewing depend on optional infrastructure
it has moderation and abuse handling
it does not contradict the SFW/suggestive-not-NSFW product boundary
```

---

## 16. Explicit Non-Goals Unless Separately Approved

```txt
mature/adult UGC platform
native video hosting
generic URL shortener
unbounded public tag creation
unbounded communities
full Reddit clone behavior without demand
provider zoo
AdSense-dependent architecture
analytics surveillance product
```
