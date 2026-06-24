import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount, useAuthToken } from "../app/account.ts";
import { ApiError, setUsername } from "../app/api.ts";

// When a signed-in user has no local handle yet, prompt them to choose one before
// they can post/comment/react (spec §17, ROADMAP V1-033).
export function UsernameGate() {
  const account = useAccount();
  const getToken = useAuthToken();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!account.data?.needsUsername) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setUsername(value.trim().toLowerCase(), getToken);
      await queryClient.invalidateQueries({ queryKey: ["account"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that username.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 hard-panel p-4">
      <h2 className="font-display text-2xl uppercase leading-none">Pick your @handle</h2>
      <p className="mt-1 text-sm font-bold">
        Choose a username before you post, comment, or react.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-black">@</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="lucas"
          className="h-10 flex-1 border-2 border-ink bg-newsprint px-3 font-mono text-sm font-bold"
          autoCapitalize="none"
          autoComplete="off"
        />
        <button type="submit" className="tool-button bg-signal" disabled={saving}>
          {saving ? "Saving…" : "Claim"}
        </button>
      </form>
      {error && <p className="mt-2 font-mono text-xs font-black uppercase text-oxide">{error}</p>}
    </div>
  );
}
