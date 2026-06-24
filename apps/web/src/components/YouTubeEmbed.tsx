import { ExternalLink, PlayCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// A plain <iframe> can't tell us when a video refuses to embed — it just loads
// YouTube's own "unavailable" page cross-origin. The IFrame Player API does:
// onError fires 101/150 when the owner disabled off-site playback, and 100 when
// the video is private/removed. We also fall back if the API script never loads,
// so a blocker/offline state becomes a direct YouTube link instead of a blank box.

type YTPlayer = { destroy: () => void };
type YTErrorEvent = { data: number };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: { onError?: (event: YTErrorEvent) => void };
    },
  ) => YTPlayer;
};
type EmbedFallback = number | "api";

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Codes that mean "this embed will never play here" (vs. transient/HTML5 errors).
const BLOCKING_CODES = new Set([100, 101, 150]);

let apiReady: Promise<YTNamespace> | null = null;

// Load the IFrame Player API once and share the promise across every embed.
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiReady) return apiReady;

  apiReady = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }
      apiReady = null;
      reject(new Error("youtube api timeout"));
    }, 5000);

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) {
        window.clearTimeout(timeout);
        resolve(window.YT);
      }
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => {
        window.clearTimeout(timeout);
        apiReady = null;
        reject(new Error("youtube api load failed"));
      };
      document.head.appendChild(tag);
    }
  });
  return apiReady;
}

export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState<EmbedFallback | null>(null);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  useEffect(() => {
    setFallback(null);
    let player: YTPlayer | null = null;
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !frameRef.current) return;
        // The API replaces the node we pass it with the <iframe>, so hand it a
        // throwaway child rather than the ref node React owns.
        const mount = document.createElement("div");
        frameRef.current.appendChild(mount);
        player = new YT.Player(mount, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onError: (event) => {
              if (!cancelled && BLOCKING_CODES.has(event.data)) setFallback(event.data);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFallback("api");
      });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch { /* player may already be gone */ }
      if (frameRef.current) frameRef.current.replaceChildren();
    };
  }, [videoId]);

  const blocked = fallback !== null;

  return (
    <div className="yt-embed">
      <div ref={frameRef} className="yt-embed__frame" aria-hidden={blocked} />
      {blocked && (
        <div className="yt-embed__fallback" role="note">
          <PlayCircle className="yt-embed__icon" aria-hidden="true" size={32} />
          <p className="yt-embed__title">Can't play here</p>
          <p className="yt-embed__note">
            {fallback === "api"
              ? "YouTube could not load in this browser right now."
              : fallback === 100
              ? "This video is private or no longer available."
              : "This video's owner disabled playback on other sites."}
          </p>
          <a
            className="yt-embed__cta"
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch on YouTube
            <ExternalLink aria-hidden="true" size={15} />
          </a>
          <span className="sr-only">{title}</span>
        </div>
      )}
    </div>
  );
}
