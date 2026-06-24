import type { CreatePostInput, PostKind } from "@doomscrollr/shared/types.ts";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { ApiError, createPost } from "../../app/api.ts";

const TABS: { kind: PostKind; label: string }[] = [
  { kind: "text", label: "Text" },
  { kind: "external_image", label: "Image link" },
  { kind: "youtube", label: "YouTube" },
];

export function CreatePage() {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const navigate = useNavigate();

  const [kind, setKind] = useState<PostKind>("text");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <div className="hard-panel p-5">
        <h1 className="font-display text-3xl uppercase leading-none">Sign in to post</h1>
        <p className="mt-2 text-sm font-bold">Use the Sign in button in the header to continue.</p>
      </div>
    );
  }

  function buildInput(): CreatePostInput {
    const tagList = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (kind === "text") return { postKind: "text", title, bodyText, tags: tagList };
    if (kind === "external_image") return { postKind: "external_image", title, imageUrl, tags: tagList };
    return { postKind: "youtube", title, youtubeUrl, tags: tagList };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { post } = await createPost(buildInput(), getToken);
      navigate({ to: "/p/$postCode/$slug", params: { postCode: post.publicCode, slug: post.slug } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl uppercase leading-none">Create a post</h1>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setKind(tab.kind)}
            className={`tool-button ${kind === tab.kind ? "bg-signal" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="hard-panel space-y-3 p-4">
        <Field label="Title">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Say something"
            className="h-10 w-full border-2 border-ink bg-newsprint px-3 text-sm font-bold"
            maxLength={180}
          />
        </Field>

        {kind === "text" && (
          <Field label="Body">
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              className="min-h-32 w-full resize-y border-2 border-ink bg-newsprint p-3 text-sm font-bold"
              placeholder="Write your post"
            />
          </Field>
        )}
        {kind === "external_image" && (
          <Field label="Image URL">
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/meme.jpg"
              className="h-10 w-full border-2 border-ink bg-newsprint px-3 text-sm font-bold"
            />
          </Field>
        )}
        {kind === "youtube" && (
          <Field label="YouTube URL">
            <input
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="h-10 w-full border-2 border-ink bg-newsprint px-3 text-sm font-bold"
            />
          </Field>
        )}

        <Field label="Tags (optional, comma separated)">
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="programming, memes"
            className="h-10 w-full border-2 border-ink bg-newsprint px-3 font-mono text-sm font-bold"
          />
        </Field>

        {error && <p className="font-mono text-xs font-black uppercase text-oxide">{error}</p>}

        <button type="submit" className="tool-button bg-signal" disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[11px] font-black uppercase text-oxide">{label}</span>
      {children}
    </label>
  );
}
