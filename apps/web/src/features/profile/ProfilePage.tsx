import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount, useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { blockUser, fetchUser, fetchUserPosts, unblockUser } from "../../app/api.ts";
import { PostCard } from "../feed/PostCard.tsx";

export function ProfilePage() {
  const { t } = useTranslation();
  const params = useParams({ strict: false }) as { username?: string };
  const username = params.username ?? "";
  const handle = username.replace(/^@/, "");
  const getToken = useAuthToken();
  const signedIn = useIsSignedIn();

  const userQuery = useQuery({
    queryKey: ["user", handle],
    queryFn: () => fetchUser(handle),
    enabled: username.startsWith("@"),
  });
  const postsQuery = useQuery({
    queryKey: ["user-posts", handle, signedIn],
    queryFn: () => fetchUserPosts(handle, getToken),
    enabled: username.startsWith("@"),
  });

  if (!username.startsWith("@")) return <Shell message={t("profile.routeNotFound")} />;
  if (userQuery.isPending) return <Shell message={t("profile.loading")} />;
  if (userQuery.isError || !userQuery.data) return <Shell message={t("profile.notFound")} />;

  const user = userQuery.data;
  const posts = postsQuery.data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="hard-panel grid gap-4 bg-paper p-5 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
        <img
          src={user.avatarUrl ?? `https://api.dicebear.com/9.x/shapes/svg?seed=${user.username}`}
          alt=""
          className="h-[88px] w-[88px] rounded-2xl border border-ink/10 bg-newsprint object-cover"
        />
        <div className="min-w-0">
          <p className="meta-label">@{user.username}</p>
          <h1 className="truncate font-display text-3xl font-bold leading-tight tracking-[-0.02em]">
            {user.displayName ?? user.username}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm font-medium text-ink/70">
            <span>{t("profile.posts", { count: user.postCount })}</span>
            <span aria-hidden="true" className="text-ink/30">·</span>
            <span>{t("profile.comments", { count: user.commentCount })}</span>
            {user.role === "admin" && <span className="tag-chip">{t("profile.admin")}</span>}
            <BlockControl profileUsername={user.username} />
          </div>
        </div>
      </div>

      {posts.length === 0
        ? (
          <div className="hard-panel p-5">
            <p className="text-sm font-bold">{t("profile.noPosts")}</p>
          </div>
        )
        : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <PostCard
                key={post.publicCode}
                post={post}
                index={index}
              />
            ))}
          </div>
        )}
    </section>
  );
}

function BlockControl({ profileUsername }: { profileUsername: string }) {
  const { t } = useTranslation();
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
      aria-pressed={blocked}
      className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 font-semibold transition hover:bg-oxide hover:text-pitch"
    >
      {blocked ? t("profile.unblock") : t("profile.block")}
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
