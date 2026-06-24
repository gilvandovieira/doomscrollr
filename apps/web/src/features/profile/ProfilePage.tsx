import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { fetchUser, fetchUserPosts } from "../../app/api.ts";
import { PostCard } from "../feed/PostCard.tsx";

export function ProfilePage() {
  const params = useParams({ strict: false }) as { username?: string };
  const username = params.username ?? "";
  const userQuery = useQuery({
    queryKey: ["user", username],
    queryFn: () => fetchUser(username),
    enabled: username.startsWith("@"),
  });
  const postsQuery = useQuery({
    queryKey: ["user-posts", username],
    queryFn: () => fetchUserPosts(username),
    enabled: username.startsWith("@"),
  });

  if (!username.startsWith("@")) {
    return (
      <div className="hard-panel grid min-h-80 place-items-center bg-newsprint p-6">
        <p className="font-mono text-sm font-black uppercase">Route not found</p>
      </div>
    );
  }

  if (userQuery.isLoading) {
    return (
      <div className="hard-panel grid min-h-80 place-items-center bg-newsprint p-6">
        <p className="font-mono text-sm font-black uppercase">Loading profile</p>
      </div>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="hard-panel grid min-h-80 place-items-center bg-newsprint p-6">
        <p className="font-mono text-sm font-black uppercase">Profile not found</p>
      </div>
    );
  }

  const user = userQuery.data;
  const posts = postsQuery.data?.items ?? [];

  return (
    <section className="space-y-5">
      <div className="hard-panel grid gap-4 bg-paper p-4 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
        <img
          src={user.avatarUrl}
          alt=""
          className="h-24 w-24 border-2 border-ink bg-newsprint object-cover"
        />
        <div className="min-w-0">
          <p className="font-mono text-xs font-black uppercase text-oxide">@{user.username}</p>
          <h1 className="truncate font-display text-5xl uppercase leading-none">
            {user.displayName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6">{user.bio}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:w-64">
          <ProfileStat label="posts" value={user.postCount} />
          <ProfileStat label="comments" value={user.commentCount} />
          <ProfileStat label="role" value={user.role} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => <PostCard key={post.id} post={post} rank={index + 1} />)}
      </div>
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-2 border-ink bg-newsprint p-2 text-center">
      <p className="truncate text-xl font-black uppercase">{value}</p>
      <p className="font-mono text-[10px] font-black uppercase text-oxide">{label}</p>
    </div>
  );
}
