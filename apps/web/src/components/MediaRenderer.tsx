import type { MediaAsset } from "@doomscrollr/shared/types.ts";
import { Play } from "lucide-react";

type MediaRendererProps = {
  media: MediaAsset;
  mode: "card" | "detail";
};

const aspectClass = {
  landscape: "aspect-video",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  unknown: "aspect-video",
};

export function MediaRenderer({ media, mode }: MediaRendererProps) {
  const className = `relative w-full overflow-hidden bg-pitch ${
    mode === "card" ? "aspect-[4/3]" : aspectClass[media.aspectRatio]
  }`;

  if (media.provider === "youtube" && mode === "detail" && media.embedUrl) {
    return (
      <div className={className}>
        <iframe
          className="h-full w-full"
          src={media.embedUrl}
          title="YouTube player"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const source = media.provider === "giphy"
    ? media.previewUrl ?? media.thumbnailUrl
    : media.thumbnailUrl;

  return (
    <div className={className}>
      <img
        src={source}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      {media.provider === "youtube"
        ? (
          <div className="absolute inset-0 grid place-items-center bg-ink/15">
            <span className="grid h-14 w-14 place-items-center border-2 border-ink bg-signal text-ink shadow-[4px_4px_0_#181512]">
              <Play aria-hidden="true" size={24} fill="currentColor" />
            </span>
          </div>
        )
        : null}
      <div className="absolute bottom-2 left-2 border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px] font-black uppercase">
        {media.provider}
      </div>
    </div>
  );
}
