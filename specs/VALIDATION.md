# Package Validation Notes

- no v1bet: PASS
- no alpha as current: PASS
- v1 has no external_url column: PASS
- v1 post events post_id is NOT NULL: PASS
- v1 client event types separated: PASS
- roadmap tags are optional in v1: PASS

## V1 Live Validation Run

Use this checklist for `ROADMAP.md` V1-090 through V1-094.

### Invite

- Recruit 5-10 testers who already share memes or links in WhatsApp.
- Include at least 2 people who will create posts and 3 people who will only open shared links.
- Send only canonical post URLs (`/p/:postCode/:slug`) in WhatsApp.

### Prompt

Ask creators to:

- create one text post, image-link post, or YouTube/Shorts post;
- share the canonical URL to one WhatsApp group or direct chat;
- return later if friends comment or react.

Ask recipients to:

- open the WhatsApp preview link;
- react or comment if they have a response;
- report or block anything that feels wrong.

### Measure

Run the quantitative report for the test window:

```sh
FUNNEL_REPORT_SINCE=2026-06-24T00:00:00Z deno task report:funnel
```

Record:

- created posts and posts per creator;
- WhatsApp share clicks, copy-link clicks, native-share clicks;
- post opens from shared links;
- comments and reactions from visitors;
- new users after opening shared posts;
- creators returning after comments or reactions;
- friends creating their own posts.

### Feedback

Ask testers:

- Was post creation clear on mobile?
- Did the WhatsApp preview make the post worth opening?
- Was reading, reacting, and commenting fast enough?
- Were report and block controls discoverable without getting in the way?
- What made them stop before creating, reacting, commenting, or sharing?

### Decision

Use the report and feedback to choose one:

- iterate v1 if the share/open/comment loop is weak or confusing;
- open v2 planning only if real shared opens and follow-on activity happened.
