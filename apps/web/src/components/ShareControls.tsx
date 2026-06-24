import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { sendEvent } from "../app/api.ts";

// Share the canonical (server-rendered, OG-previewable) URL — the centerpiece of
// the v1 loop (spec §10). The canonical origin is the API origin so WhatsApp reads
// real Open Graph metadata.
const SHARE_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function canonicalUrl(post: FeedPost): string {
  return `${SHARE_BASE}${post.canonicalPath}`;
}

export function ShareControls({ post }: { post: FeedPost }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const url = canonicalUrl(post);
  const shareData: ShareData = { title: post.title, text: post.title, url };
  const canUseNativeShare = typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare(shareData));

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
    if (canUseNativeShare) {
      await navigator.share(shareData).catch(() => {});
    }
  }

  return (
    <div className="share-controls">
      <button type="button" onClick={shareWhatsApp} className="tool-button share-whatsapp">
        <Share2 aria-hidden="true" size={17} />
        {t("post.whatsapp")}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className={`tool-button share-controls__copy ${
          copied ? "share-controls__copy--copied" : ""
        }`}
      >
        {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
        {copied ? t("post.copied") : t("post.copyLink")}
      </button>
      {canUseNativeShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="icon-button"
          aria-label={t("post.share")}
        >
          <Share2 aria-hidden="true" size={18} />
        </button>
      )}
    </div>
  );
}
