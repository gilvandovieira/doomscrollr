import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the funnel report.");
}

const since = readOptionalDate("FUNNEL_REPORT_SINCE");
const until = readOptionalDate("FUNNEL_REPORT_UNTIL");
const sql = postgres(databaseUrl, { max: 1 });

try {
  const [summary] = await sql`
    SELECT
      (SELECT count(*)::int FROM posts
        WHERE (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
          AND (${until}::timestamptz IS NULL OR created_at < ${until}::timestamptz)
      ) AS posts_created,
      (SELECT count(DISTINCT author_id)::int FROM posts
        WHERE (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
          AND (${until}::timestamptz IS NULL OR created_at < ${until}::timestamptz)
      ) AS creators,
      (SELECT count(*)::int FROM comments
        WHERE (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
          AND (${until}::timestamptz IS NULL OR created_at < ${until}::timestamptz)
      ) AS comments_created,
      (SELECT count(DISTINCT author_id)::int FROM comments
        WHERE (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
          AND (${until}::timestamptz IS NULL OR created_at < ${until}::timestamptz)
      ) AS commenters
  `;

  const eventRows = await sql`
    SELECT
      event_type,
      count(*)::int AS events,
      count(DISTINCT actor_user_id) FILTER (WHERE actor_user_id IS NOT NULL)::int AS users,
      count(DISTINCT anon_session_id) FILTER (WHERE anon_session_id IS NOT NULL)::int AS anon_sessions
    FROM post_events
    WHERE (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
      AND (${until}::timestamptz IS NULL OR created_at < ${until}::timestamptz)
    GROUP BY event_type
    ORDER BY event_type
  `;

  const postRows = await sql`
    SELECT
      p.public_code,
      p.slug,
      left(p.title, 80) AS title,
      u.username AS author,
      count(e.id) FILTER (WHERE e.event_type = 'post_opened')::int AS opens,
      count(e.id) FILTER (WHERE e.event_type = 'whatsapp_share_clicked')::int AS whatsapp_shares,
      count(e.id) FILTER (WHERE e.event_type = 'copy_link_clicked')::int AS copy_link_shares,
      count(e.id) FILTER (WHERE e.event_type = 'native_share_clicked')::int AS native_shares,
      count(e.id) FILTER (WHERE e.event_type = 'comment_created')::int AS comment_events,
      count(e.id) FILTER (WHERE e.event_type = 'reaction_created')::int AS reaction_events,
      count(DISTINCT e.anon_session_id) FILTER (WHERE e.anon_session_id IS NOT NULL)::int AS anon_sessions
    FROM posts p
    INNER JOIN users u ON u.id = p.author_id
    LEFT JOIN post_events e ON e.post_id = p.id
      AND (${since}::timestamptz IS NULL OR e.created_at >= ${since}::timestamptz)
      AND (${until}::timestamptz IS NULL OR e.created_at < ${until}::timestamptz)
    WHERE (${since}::timestamptz IS NULL OR p.created_at >= ${since}::timestamptz)
      AND (${until}::timestamptz IS NULL OR p.created_at < ${until}::timestamptz)
    GROUP BY p.id, p.public_code, p.slug, p.title, u.username
    ORDER BY (count(e.id) FILTER (WHERE e.event_type = 'post_opened')) DESC, p.created_at DESC
    LIMIT 25
  `;

  printReport(
    summary as Record<string, unknown>,
    eventRows as Record<string, unknown>[],
    postRows as Record<string, unknown>[],
  );
} finally {
  await sql.end();
}

function readOptionalDate(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${name} must be an ISO date or timestamp.`);
  }
  return date.toISOString();
}

function printReport(
  summary: Record<string, unknown>,
  events: Record<string, unknown>[],
  posts: Record<string, unknown>[],
) {
  console.log("# Doomscrollr V1 Funnel Report");
  console.log("");
  console.log(`Window: ${since ?? "beginning"} -> ${until ?? "now"}`);
  console.log("");
  console.log("## Creation");
  console.table([summary]);
  console.log("");
  console.log("## Events");
  console.table(events);
  console.log("");
  console.log("## Top Posts");
  console.table(posts);
  console.log("");
  console.log("Notes:");
  console.log("- comment_events and reaction_events are server-emitted post_events.");
  console.log("- creator return and friend-to-creator attribution still require live-run review.");
}
