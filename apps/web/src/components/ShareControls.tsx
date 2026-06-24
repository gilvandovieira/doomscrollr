import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { sendEvent } from "../app/api.ts";

// Share the canonical (server-rendered, OG-previewable) URL — the centerpiece of
// the v1 loop (spec §10). The canonical origin is the API origin so WhatsApp reads
// real Open Graph metadata.
const SHARE_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function canonicalUrl(post: FeedPost): string {
  return `${SHARE_BASE}${post.canonicalPath}`;
}

export function ShareControls({ post }: { post: FeedPost }) {
  const [copied, setCopied] = useState(false);
  const url = canonicalUrl(post);

  function shareWhatsApp() {
    sendEvent("whatsapp_share_clicked", post.publicCode);
    const message = `${post.title}\n${url}`;
    globalThis.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  async function copyLink() {
    sendEvent("copy_link_clicked", post.publicCode);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  async function nativeShare() {
    sendEvent("native_share_clicked", post.publicCode);
    if (navigator.share) {
      await navigator.share({ title: post.title, url }).catch(() => {});
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={shareWhatsApp} className="tool-button bg-signal">
        <Share2 aria-hidden="true" size={17} />
        WhatsApp
      </button>
      <button type="button" onClick={copyLink} className="tool-button">
        {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <button type="button" onClick={nativeShare} className="icon-button" aria-label="Share">
          <Share2 aria-hidden="true" size={18} />
        </button>
      )}
    </div>
  );
}
