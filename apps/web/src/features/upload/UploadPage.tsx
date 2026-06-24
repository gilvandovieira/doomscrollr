import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Link as LinkIcon, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { fetchGifs } from "../../app/api.ts";

const tabs = ["youtube", "gif", "upload"] as const;
type UploadTab = typeof tabs[number];

export function UploadPage() {
  const [activeTab, setActiveTab] = useState<UploadTab>("youtube");

  return (
    <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3 border-b-2 border-ink pb-4 lg:border-b-0 lg:border-r-2 lg:pb-0 lg:pr-5">
        <p className="font-mono text-xs font-black uppercase text-oxide">Create post</p>
        <h1 className="font-display text-5xl uppercase leading-none">
          Bring a link. Start a thread.
        </h1>
        <p className="text-sm font-bold leading-6">
          The first build supports the composer shell and provider selection. Publishing is reserved
          for the auth and media-provider phases.
        </p>
      </div>

      <div className="hard-panel bg-paper">
        <div className="grid grid-cols-3 border-b-2 border-ink">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex h-12 items-center justify-center gap-2 border-r-2 border-ink px-2 text-sm font-black uppercase last:border-r-0 ${
                activeTab === tab ? "bg-signal" : "bg-newsprint"
              }`}
            >
              {tab === "youtube" ? <LinkIcon aria-hidden="true" size={17} /> : null}
              {tab === "gif" ? <Search aria-hidden="true" size={17} /> : null}
              {tab === "upload" ? <ImagePlus aria-hidden="true" size={17} /> : null}
              <span className="hidden sm:inline">{tab}</span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "youtube" ? <YouTubePane /> : null}
          {activeTab === "gif" ? <GifPane /> : null}
          {activeTab === "upload" ? <UploadPane /> : null}
        </div>
      </div>
    </section>
  );
}

function YouTubePane() {
  return (
    <form className="grid gap-4">
      <label className="grid gap-2">
        <span className="font-mono text-xs font-black uppercase text-oxide">
          YouTube or Shorts URL
        </span>
        <input
          className="h-12 border-2 border-ink bg-newsprint px-3 font-bold"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </label>
      <label className="grid gap-2">
        <span className="font-mono text-xs font-black uppercase text-oxide">Title</span>
        <input
          className="h-12 border-2 border-ink bg-newsprint px-3 font-bold"
          placeholder="When production breaks on Friday"
        />
      </label>
      <button type="button" className="tool-button w-fit" disabled>
        <LinkIcon aria-hidden="true" size={17} />
        Resolve link
      </button>
    </form>
  );
}

function GifPane() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query).trim();
  const gifsQuery = useQuery({
    queryKey: ["gifs", deferredQuery],
    queryFn: () => fetchGifs(deferredQuery),
  });

  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className="font-mono text-xs font-black uppercase text-oxide">GIF search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 border-2 border-ink bg-newsprint px-3 font-bold"
          placeholder="cache, launch, validation"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {(gifsQuery.data ?? []).map((gif) => (
          <button
            type="button"
            key={gif.id}
            className="overflow-hidden border-2 border-ink bg-newsprint text-left transition hover:-translate-y-0.5 hover:shadow-hard"
          >
            <img
              src={gif.previewUrl ?? gif.thumbnailUrl}
              alt=""
              className="aspect-video w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <span className="block truncate px-2 py-2 font-mono text-xs font-black uppercase">
              {gif.attributionLabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadPane() {
  return (
    <div className="grid min-h-72 place-items-center border-2 border-dashed border-ink bg-newsprint p-6 text-center">
      <div>
        <ImagePlus aria-hidden="true" className="mx-auto" size={34} />
        <p className="mt-3 max-w-sm text-sm font-bold leading-6">
          Uploaded images and GIFs stay disabled until storage, moderation, MIME checks, and
          thumbnail generation are ready.
        </p>
      </div>
    </div>
  );
}
