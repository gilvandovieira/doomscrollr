# Doomscrollr Specs Package

This package contains the cleaned Doomscrollr roadmap/spec set.

## Files

```txt
doomscrollr_roadmap_v1_v2_v3_future.md
doomscrollr_v1_implementation_roadmap.md
specs/doomscrollr_spec_v1.md
specs/doomscrollr_spec_v2_milestone.md
specs/doomscrollr_spec_v3_target.md
specs/doomscrollr_future_milestones.md
```

## Source Of Truth

The active v1 source of truth is:

```txt
specs/doomscrollr_spec_v1.md
```

For v1 implementation decisions, the v1 spec wins over roadmap summaries, README copy, current code,
mock data, and implementation-roadmap task wording.

Document roles:

```txt
specs/doomscrollr_spec_v1.md                 controls current v1 implementation
doomscrollr_roadmap_v1_v2_v3_future.md       controls the version ladder only
doomscrollr_v1_implementation_roadmap.md      orders current engineering work
specs/doomscrollr_spec_v2_milestone.md        future milestone candidate
specs/doomscrollr_spec_v3_target.md           future platform target
specs/doomscrollr_future_milestones.md        deferred backlog and research pins
```

## Current Product Position

Doomscrollr v1 is a SFW-only, mobile-first validation product.

The core hypothesis is:

```txt
Will people create posts, share them to WhatsApp, and get friends to open, react, comment, or create their own posts?
```

The v1 spec is the controlling implementation contract. v2 and v3 are milestones/targets, not immediate build scope.

## Scope Principles

```txt
Earn every subsystem back with usage.
Keep WhatsApp sharing central.
Do not bake ads, mature content, uploads, rankings, or communities into v1.
Keep the implementation roadmap subordinate to the v1 spec.
```

## Most Important v1 Requirement

`/p/:postCode` must return server-rendered Open Graph metadata in the initial HTML response. WhatsApp previews must not depend on client-side React execution.
