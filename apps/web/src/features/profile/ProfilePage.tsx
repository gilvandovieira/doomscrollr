import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount, useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { blockUser, fetchUser, fetchUserPosts, unblockUser } from "../../app/api.ts";
import { PostCard } from "../feed/PostCard.tsx";

export function ProfilePage() {
  const params = useParams({ strict: false }) as { username?: string };
  const username = params.username ?? "";
  const handle = username.replace(/^@/, "");

  const userQuery = useQuery({
    queryKey: ["user", handle],
    queryFn: () => fetchUser(handle),
    enabled: username.startsWith("@"),
  });
  const postsQuery = useQuery({
    queryKey: ["user-posts", handle],
    queryFn: () => fetchUserPosts(handle),
    enabled: username.startsWith("@"),
  });

  if (!username.startsWith("@")) return <Shell message="Route not found" />;
  if (userQuery.isPending) return <Shell message="Loading profile…" />;
  if (userQuery.isError || !userQuery.data) return <Shell message="Profile not found" />;

  const user = userQuery.data;
  const posts = postsQuery.data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="hard-panel grid gap-4 bg-paper p-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center">
        <img
          src={user.avatarUrl ?? `https://api.dicebear.com/9.x/shapes/svg?seed=${user.username}`}
          alt=""
          className="h-24 w-24 rounded-[var(--radius-card)] border-2 border-ink bg-newsprint object-cover"
        />
        <div className="min-w-0">
          <p className="meta-label text-oxide">@{user.username}</p>
          <h1 className="truncate text-4xl font-black leading-none tracking-[-0.02em]">
            {user.displayName ?? user.username}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs font-black">
            <span>{user.postCount} posts</span>
            <span>{user.commentCount} comments</span>
            {user.role === "admin" && <span className="text-oxide">admin</span>}
            <BlockControl profileUsername={user.username} />
          </div>
        </div>
      </div>

      {posts.length === 0
        ? (
          <div className="hard-panel p-5">
            <p className="text-sm font-bold">No posts yet.</p>
          </div>
        )
        : (
          <div className="space-y-4">
            {posts.map((post) => <PostCard key={post.publicCode} post={post} />)}
          </div>
        )}
    </section>
  );
}

function BlockControl({ profileUsername }: { profileUsername: string }) {
  const signedIn = useIsSignedIn();
  const account = useAccount();
  const getToken = useAuthToken();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!signedIn) return null;
  if (account.data?.user?.username === profileUsername) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (blocked) {
        await unblockUser(profileUsername, getToken);
        setBlocked(false);
      } else {
        await blockUser(profileUsername, getToken);
        setBlocked(true);
      }
    } catch {
      // Ignore; user can retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-black hover:bg-oxide hover:text-pitch"
    >
      {blocked ? "Unblock" : "Block"}
    </button>
  );
}

function Shell({ message }: { message: string }) {
  return (
    <div className="hard-panel grid min-h-60 place-items-center bg-newsprint p-6">
      <p className="text-center text-sm font-black">{message}</p>
    </div>
  );
}
