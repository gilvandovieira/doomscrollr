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
        <h1 className="mobile-title">Sign in to post</h1>
        <p className="mt-2 text-sm font-bold">Posting needs an account. Reading stays open.</p>
      </div>
    );
  }

  function buildInput(): CreatePostInput {
    const tagList = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (kind === "text") return { postKind: "text", title, bodyText, tags: tagList };
    if (kind === "external_image") {
      return { postKind: "external_image", title, imageUrl, tags: tagList };
    }
    return { postKind: "youtube", title, youtubeUrl, tags: tagList };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { post } = await createPost(buildInput(), getToken);
      navigate({
        to: "/p/$postCode/$slug",
        params: { postCode: post.publicCode, slug: post.slug },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <h1 className="mobile-title">Create a post</h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setKind(tab.kind)}
            aria-pressed={kind === tab.kind}
            className={`tool-button px-2 ${kind === tab.kind ? "bg-signal text-pitch" : ""}`}
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
            className="field-control min-h-11 px-3 text-sm"
            maxLength={180}
          />
        </Field>

        <div key={kind} className="create-kind-fields">
          {kind === "text" && (
            <Field label="Body">
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="field-control min-h-32 resize-y p-3 text-sm"
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
                className="field-control min-h-11 px-3 text-sm"
              />
            </Field>
          )}
          {kind === "youtube" && (
            <Field label="YouTube URL">
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="field-control min-h-11 px-3 text-sm"
              />
            </Field>
          )}
        </div>

        <Field label="Tags (optional, comma separated)">
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="programming, memes"
            className="field-control min-h-11 px-3 font-mono text-sm"
          />
        </Field>

        {error && <p className="meta-label text-oxide">{error}</p>}

        <button type="submit" className="tool-button w-full bg-signal text-pitch" disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="meta-label">{label}</span>
      {children}
    </label>
  );
}
