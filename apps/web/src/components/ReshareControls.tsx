import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Quote, Repeat2, Send } from "lucide-react";
import { useState } from "react";
import { useAccount, useAuthToken, useIsSignedIn } from "../app/account.ts";
import { ApiError, createQuote, createRepost } from "../app/api.ts";

type ReshareControlsProps = {
  post: FeedPost;
  variant?: "compact" | "detail";
};

export function ReshareControls({ post, variant = "detail" }: ReshareControlsProps) {
  const signedIn = useIsSignedIn();
  const account = useAccount();
  const getToken = useAuthToken();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const repostMutation = useMutation({
    mutationFn: () => createRepost(post.publicCode, getToken),
    onMutate: () => setError(null),
    onSuccess: ({ post: created }) => {
      invalidateReshareData(queryClient, post.publicCode);
      navigate({
        to: "/p/$postCode/$slug",
        params: { postCode: created.publicCode, slug: created.slug },
      });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not repost this.");
    },
  });

  const quoteMutation = useMutation({
    mutationFn: () => createQuote(post.publicCode, { bodyText: quoteText.trim() }, getToken),
    onMutate: () => setError(null),
    onSuccess: ({ post: created }) => {
      setQuoteText("");
      setQuoteOpen(false);
      invalidateReshareData(queryClient, post.publicCode);
      navigate({
        to: "/p/$postCode/$slug",
        params: { postCode: created.publicCode, slug: created.slug },
      });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not quote this.");
    },
  });

  const busy = repostMutation.isPending || quoteMutation.isPending;
  const canQuote = signedIn && quoteText.trim().length > 0 && !busy;

  function submitQuote(event: React.FormEvent) {
    event.preventDefault();
    if (!canQuote) return;
    quoteMutation.mutate();
  }

  // You can't repost or quote your own post (anti-spam); don't offer the action.
  if (signedIn && account.data?.user?.username === post.author.username) return null;

  return (
    <div className="reshare-controls" data-variant={variant}>
      <div className="reshare-controls__actions">
        <button
          type="button"
          className="tool-button reshare-controls__button"
          onClick={() => repostMutation.mutate()}
          disabled={!signedIn || busy}
          title={signedIn ? "Repost" : "Sign in to repost"}
        >
          <Repeat2 aria-hidden="true" size={16} />
          <span>Repost</span>
          <span className="reshare-controls__count">{post.repostCount}</span>
        </button>
        <button
          type="button"
          className="tool-button reshare-controls__button"
          onClick={() => {
            setQuoteOpen((current) => !current);
            setError(null);
          }}
          disabled={!signedIn || busy}
          aria-expanded={quoteOpen}
          title={signedIn ? "Quote" : "Sign in to quote"}
        >
          <Quote aria-hidden="true" size={16} />
          <span>Quote</span>
          <span className="reshare-controls__count">{post.quoteCount}</span>
        </button>
      </div>

      {quoteOpen && (
        <form className="quote-compose" onSubmit={submitQuote}>
          <textarea
            value={quoteText}
            onChange={(event) => setQuoteText(event.target.value)}
            className="field-control quote-compose__input"
            placeholder="Add your take"
            maxLength={2000}
            rows={variant === "compact" ? 2 : 3}
          />
          <div className="quote-compose__bar">
            {error && <p className="quote-compose__error">{error}</p>}
            <button type="submit" className="tool-button bg-signal" disabled={!canQuote}>
              <Send aria-hidden="true" size={16} />
              Quote
            </button>
          </div>
        </form>
      )}

      {!quoteOpen && error && <p className="quote-compose__error">{error}</p>}
    </div>
  );
}

function invalidateReshareData(
  queryClient: ReturnType<typeof useQueryClient>,
  sourcePostCode: string,
) {
  void queryClient.invalidateQueries({ queryKey: ["feed"] });
  void queryClient.invalidateQueries({ queryKey: ["post", sourcePostCode] });
}
