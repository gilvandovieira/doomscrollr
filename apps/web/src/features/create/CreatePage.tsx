import type { CreatePostInput, PostKind } from "@doomscrollr/shared/types.ts";
import { MAX_TAGS_PER_POST } from "@doomscrollr/shared/constants.ts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { ApiError, createPost, fetchTags, fetchYouTubeTitle } from "../../app/api.ts";

type CreatablePostKind = Extract<PostKind, "text" | "external_image" | "youtube">;

const TABS: { kind: CreatablePostKind; labelKey: string }[] = [
  { kind: "text", labelKey: "create.tabs.text" },
  { kind: "external_image", labelKey: "create.tabs.image" },
  { kind: "youtube", labelKey: "create.tabs.youtube" },
];
const URL_PATTERN = /https?:\/\/\S+/i;
const IMAGE_PATH_PATTERN = /\.(avif|gif|jpe?g|png|webp)$/i;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

type ShareTargetDraft = {
  kind: CreatablePostKind;
  title: string;
  bodyText: string;
  imageUrl: string;
  youtubeUrl: string;
};

export function CreatePage() {
  const { t } = useTranslation();
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const navigate = useNavigate();
  const [shareDraft] = useState(readShareTargetDraft);

  const [kind, setKind] = useState<CreatablePostKind>(shareDraft.kind);
  const [title, setTitle] = useState(shareDraft.title);
  const [bodyText, setBodyText] = useState(shareDraft.bodyText);
  const [imageUrl, setImageUrl] = useState(shareDraft.imageUrl);
  const [youtubeUrl, setYoutubeUrl] = useState(shareDraft.youtubeUrl);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
    staleTime: 120_000,
  });
  const [titleLoading, setTitleLoading] = useState(false);
  // Tracks whether the user has typed their own title; if so we never overwrite it.
  const titleTouched = useRef(shareDraft.title.trim().length > 0);

  // Paste a YouTube link and the title fills in from the video (server oEmbed),
  // debounced. Bails on a stale URL and never clobbers a title the user typed.
  useEffect(() => {
    if (kind !== "youtube" || titleTouched.current) return;
    const url = youtubeUrl.trim();
    if (!isYouTubeUrl(url)) return;

    let active = true;
    const handle = setTimeout(() => {
      setTitleLoading(true);
      fetchYouTubeTitle(url)
        .then((fetched) => {
          if (active && fetched && !titleTouched.current) setTitle(fetched.slice(0, 180));
        })
        .finally(() => {
          if (active) setTitleLoading(false);
        });
    }, 600);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [youtubeUrl, kind]);

  if (!signedIn) {
    return (
      <div className="hard-panel p-5">
        <h1 className="mobile-title">{t("create.signInTitle")}</h1>
        <p className="mt-2 text-sm font-bold">{t("create.signInBody")}</p>
      </div>
    );
  }

  function buildInput(): CreatePostInput {
    if (kind === "text") return { postKind: "text", title, bodyText, tags: selectedTags };
    if (kind === "external_image") {
      return { postKind: "external_image", title, imageUrl, tags: selectedTags };
    }
    return { postKind: "youtube", title, youtubeUrl, tags: selectedTags };
  }

  function toggleTag(slug: string) {
    setSelectedTags((current) => {
      if (current.includes(slug)) return current.filter((tag) => tag !== slug);
      if (current.length >= MAX_TAGS_PER_POST) return current;
      return [...current, slug];
    });
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
      setError(err instanceof ApiError ? err.message : t("create.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <h1 className="mobile-title">{t("create.title")}</h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setKind(tab.kind)}
            aria-pressed={kind === tab.kind}
            data-kind={tab.kind}
            className="tool-button create-kind-tab px-2"
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="hard-panel space-y-3 p-4">
        <Field
          label={kind === "text" || kind === "youtube"
            ? t("create.titleOptional")
            : t("create.titleLabel")}
        >
          <div className="title-field">
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                titleTouched.current = event.target.value.trim().length > 0;
              }}
              placeholder={kind === "text"
                ? t("create.titlePlaceholderText")
                : t("create.titlePlaceholder")}
              className="field-control min-h-11 px-3 text-sm"
              maxLength={180}
              aria-busy={titleLoading}
            />
            {titleLoading && (
              <span className="title-field__loading" aria-hidden="true">
                <span className="title-field__bar" />
              </span>
            )}
          </div>
        </Field>

        <div key={kind} className="create-kind-fields">
          {kind === "text" && (
            <Field label={t("create.body")}>
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="field-control min-h-32 resize-y p-3 text-sm"
                placeholder={t("create.bodyPlaceholder")}
              />
            </Field>
          )}
          {kind === "external_image" && (
            <Field label={t("create.imageUrl")}>
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://example.com/meme.jpg"
                className="field-control min-h-11 px-3 text-sm"
              />
            </Field>
          )}
          {kind === "youtube" && (
            <>
              <Field label={t("create.youtubeUrl")}>
                <input
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="field-control min-h-11 px-3 text-sm"
                />
              </Field>
              {/* Kept outside the label so it doesn't pollute the input's accessible name. */}
              <p className="meta-label mt-2" role="status" aria-live="polite">
                {titleLoading ? t("create.ytFetching") : t("create.ytHint")}
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="meta-label">{t("create.tags")}</span>
            <span className="meta-label">
              {selectedTags.length}/{MAX_TAGS_PER_POST}
            </span>
          </div>
          <div className="tag-picker" aria-label="Choose tags">
            {(tagsQuery.data ?? []).map((tag) => {
              const selected = selectedTags.includes(tag.slug);
              const disabled = !selected && selectedTags.length >= MAX_TAGS_PER_POST;
              return (
                <button
                  key={tag.slug}
                  type="button"
                  className="tag-picker__option"
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => toggleTag(tag.slug)}
                >
                  #{tag.slug}
                </button>
              );
            })}
            {tagsQuery.isPending && <span className="meta-label">{t("create.loadingTags")}</span>}
          </div>
        </div>

        {error && <p className="meta-label text-oxide">{error}</p>}

        <button type="submit" className="tool-button w-full bg-signal text-pitch" disabled={busy}>
          {busy ? t("create.publishing") : t("create.publish")}
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

function readShareTargetDraft(): ShareTargetDraft {
  const empty: ShareTargetDraft = {
    kind: "text",
    title: "",
    bodyText: "",
    imageUrl: "",
    youtubeUrl: "",
  };
  if (typeof location === "undefined") return empty;

  const params = new URLSearchParams(location.search);
  const sharedTitle = params.get("title")?.trim() ?? "";
  const sharedText = params.get("text")?.trim() ?? "";
  const sharedUrl = params.get("url")?.trim() || extractFirstUrl(sharedText);
  if (!sharedTitle && !sharedText && !sharedUrl) return empty;

  const title = sharedTitle || firstNonUrlLine(sharedText) || "Shared link";
  if (sharedUrl && isYouTubeUrl(sharedUrl)) {
    return {
      ...empty,
      kind: "youtube",
      title,
      bodyText: textWithoutUrl(sharedText),
      youtubeUrl: sharedUrl,
    };
  }
  if (sharedUrl && isImageUrl(sharedUrl)) {
    return {
      ...empty,
      kind: "external_image",
      title,
      bodyText: textWithoutUrl(sharedText),
      imageUrl: sharedUrl,
    };
  }

  return {
    ...empty,
    title,
    bodyText: [textWithoutUrl(sharedText), sharedUrl].filter(Boolean).join("\n\n"),
  };
}

function extractFirstUrl(value: string): string {
  return value.match(URL_PATTERN)?.[0] ?? "";
}

function firstNonUrlLine(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !URL_PATTERN.test(line)) ?? "";
}

function textWithoutUrl(value: string): string {
  return value.replace(URL_PATTERN, "").trim();
}

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isImageUrl(value: string): boolean {
  try {
    return IMAGE_PATH_PATTERN.test(new URL(value).pathname);
  } catch {
    return false;
  }
}
