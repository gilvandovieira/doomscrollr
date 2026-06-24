import type { AdminTag, CreateAdminTagInput } from "@doomscrollr/shared/types.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge, Plus, Power } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { adminAction, ApiError, createAdminTag, fetchAdminTags } from "../../app/api.ts";
import { AdminShell, AdminTabs } from "./admin-nav.tsx";

// Administration: curate the fixed tag set users choose from. Three separate
// tools — create, merge, enable/disable — instead of one crammed control.
export function AdministrationPage() {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: ["admin-tags"],
    queryFn: () => fetchAdminTags(getToken),
    enabled: signedIn,
    retry: false,
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] }),
      queryClient.invalidateQueries({ queryKey: ["tags"] }),
    ]);
  }

  async function runAction(path: string, body?: unknown) {
    setError(null);
    try {
      await adminAction(path, getToken, body);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tag action failed.");
    }
  }

  async function createTag(input: CreateAdminTagInput) {
    setError(null);
    try {
      await createAdminTag(input, getToken);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create tag.");
    }
  }

  if (!signedIn) {
    return <AdminShell message="Sign in with an admin account. The server checks admin role before every change." />;
  }
  if (tagsQuery.isPending) return <AdminShell message="Loading the tag set." />;
  if (tagsQuery.isError) {
    const message = tagsQuery.error instanceof ApiError && tagsQuery.error.status === 403
      ? "Admin access required. This console is gated by server-verified role."
      : "Could not load the tag set. Tag tools stay unavailable until the read succeeds.";
    return <AdminShell message={message} />;
  }

  const tags = tagsQuery.data;
  const activeCount = tags.filter((tag) => tag.status === "active").length;
  const disabledCount = tags.length - activeCount;
  const aliasCount = tags.reduce((total, tag) => total + tag.aliases.length, 0);

  return (
    <section className="admin-workbench">
      <AdminTabs active="administration" />

      <header className="admin-workbench__masthead">
        <div className="admin-workbench__identity">
          <p className="meta-label">Administration</p>
          <h1 className="mobile-title admin-workbench__title">Tag curation</h1>
          <p className="admin-workbench__summary">
            Users attach tags from a fixed, curated set — there is no public free-form tag creation.
            Add the tags worth having, fold duplicates together, and turn tags on or off.
          </p>
        </div>
        <dl className="admin-case-tape" aria-label="Tag set summary">
          <div className="admin-case-tape__item admin-case-tape__item--open">
            <dt>Active</dt>
            <dd>{activeCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>Disabled</dt>
            <dd>{disabledCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>Total</dt>
            <dd>{tags.length}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>Aliases</dt>
            <dd>{aliasCount}</dd>
          </div>
        </dl>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <section className="hard-panel admin-tool" aria-labelledby="admin-create-title">
        <div className="admin-panel-heading">
          <div>
            <p className="meta-label">Create a tag</p>
            <h2 id="admin-create-title" className="admin-section-title">Add to the set</h2>
            <p className="admin-panel-copy">
              A new tag is active right away and selectable on posts. The slug is the permanent
              handle; the name is what people read.
            </p>
          </div>
        </div>
        <CreateTagTool onCreate={createTag} />
      </section>

      <section className="hard-panel admin-tool" aria-labelledby="admin-merge-title">
        <div className="admin-panel-heading">
          <div>
            <p className="meta-label">Merge tags</p>
            <h2 id="admin-merge-title" className="admin-section-title">Fold a duplicate in</h2>
            <p className="admin-panel-copy">
              Combine two tags that mean the same thing. The absorbed tag's posts move to the one you
              keep, and it turns into an alias so old links still resolve.
            </p>
          </div>
        </div>
        <MergeTagsTool
          tags={tags}
          onMerge={(source, target) => runAction(`tags/${source}/merge`, { targetSlug: target })}
        />
      </section>

      <section className="hard-panel admin-tool" aria-labelledby="admin-manage-title">
        <div className="admin-panel-heading">
          <div>
            <p className="meta-label">Enable or disable</p>
            <h2 id="admin-manage-title" className="admin-section-title">The current set</h2>
            <p className="admin-panel-copy">
              Disabled tags stay on their existing posts but can't be added to new ones. Re-enable any
              time.
            </p>
          </div>
        </div>
        <ManageTagsTool
          tags={tags}
          onToggle={(tag) =>
            runAction(`tags/${tag.slug}/${tag.status === "active" ? "disable" : "enable"}`)}
        />
      </section>
    </section>
  );
}

function CreateTagTool({ onCreate }: { onCreate: (input: CreateAdminTagInput) => Promise<void> }) {
  const [form, setForm] = useState<CreateAdminTagInput>({
    slug: "",
    displayName: "",
    description: null,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate({
      slug: form.slug.trim().toLowerCase(),
      displayName: form.displayName.trim(),
      description: form.description?.trim() || null,
    });
    setForm({ slug: "", displayName: "", description: null });
  }

  return (
    <form onSubmit={submit} className="admin-tag-form">
      <label className="admin-filter">
        <span>Slug</span>
        <input
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
          placeholder="wholesome-chaos"
          aria-label="Tag slug"
          className="field-control admin-mono-field"
          required
        />
      </label>
      <label className="admin-filter">
        <span>Name users see</span>
        <input
          value={form.displayName}
          onChange={(event) =>
            setForm((current) => ({ ...current, displayName: event.target.value }))}
          placeholder="Wholesome chaos"
          aria-label="Tag name users see"
          className="field-control"
          required
        />
      </label>
      <label className="admin-filter">
        <span>Curator note</span>
        <input
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Optional"
          aria-label="Tag curator note"
          className="field-control"
        />
      </label>
      <button type="submit" className="tool-button bg-signal text-pitch">
        <Plus size={16} aria-hidden="true" />
        Create tag
      </button>
    </form>
  );
}

function MergeTagsTool(
  { tags, onMerge }: { tags: AdminTag[]; onMerge: (source: string, target: string) => void },
) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);

  const sourceTag = tags.find((tag) => tag.slug === source);
  // The server only merges into an active tag, so only offer those (minus self).
  const targetOptions = tags.filter((tag) => tag.status === "active" && tag.slug !== source);
  const canReview = Boolean(source && target && source !== target);

  function pickSource(value: string) {
    setSource(value);
    if (value === target) setTarget("");
    setConfirming(false);
  }

  function confirmMerge() {
    onMerge(source, target);
    setSource("");
    setTarget("");
    setConfirming(false);
  }

  if (tags.length < 2) {
    return <p className="admin-tool__empty">Create at least two tags before you can merge.</p>;
  }

  return (
    <div className="admin-merge">
      <div className="admin-merge__sentence">
        <span className="admin-merge__word">Merge</span>
        <select
          className="field-control admin-mono-field"
          aria-label="Tag to absorb"
          value={source}
          onChange={(event) => pickSource(event.currentTarget.value)}
        >
          <option value="">choose a tag…</option>
          {tags.map((tag) => (
            <option key={tag.slug} value={tag.slug}>
              #{tag.slug} · {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
            </option>
          ))}
        </select>
        <span className="admin-merge__word">into</span>
        <select
          className="field-control admin-mono-field"
          aria-label="Tag to keep"
          value={target}
          disabled={!source}
          onChange={(event) => {
            setTarget(event.currentTarget.value);
            setConfirming(false);
          }}
        >
          <option value="">choose a tag…</option>
          {targetOptions.map((tag) => <option key={tag.slug} value={tag.slug}>#{tag.slug}</option>)}
        </select>
      </div>

      {confirming && sourceTag
        ? (
          <div className="admin-merge-confirm" role="alertdialog" aria-label="Confirm merge">
            <p className="admin-merge-confirm__q">Merge #{source} into #{target}?</p>
            <p className="admin-merge-confirm__detail">
              {sourceTag.postCount} {sourceTag.postCount === 1 ? "post moves" : "posts move"} to{" "}
              #{target}. #{source} becomes an alias of #{target} and is disabled. This can't be undone.
            </p>
            <div className="admin-merge-confirm__actions">
              <button type="button" className="tool-button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="tool-button admin-danger-button"
                onClick={confirmMerge}
              >
                <GitMerge size={16} aria-hidden="true" />
                Merge tags
              </button>
            </div>
          </div>
        )
        : (
          <button
            type="button"
            className="tool-button"
            disabled={!canReview}
            onClick={() => setConfirming(true)}
          >
            <GitMerge size={16} aria-hidden="true" />
            Review merge
          </button>
        )}
    </div>
  );
}

function ManageTagsTool(
  { tags, onToggle }: { tags: AdminTag[]; onToggle: (tag: AdminTag) => void },
) {
  return (
    <div className="admin-tag-grid">
      {tags.map((tag) => (
        <article key={tag.slug} className={`admin-tag-row admin-tag-row--${tag.status}`}>
          <div className="admin-tag-row__head">
            <div>
              <p className="admin-tag-row__slug">#{tag.slug}</p>
              <p className="admin-tag-row__name">{tag.displayName}</p>
              <div className="admin-tag-row__meta">
                <span>{tag.status}</span>
                <span>{tag.postCount} {tag.postCount === 1 ? "post" : "posts"}</span>
              </div>
              {tag.aliases.length > 0 && (
                <p className="admin-tag-row__aliases">
                  aliases: {tag.aliases.map((alias) => `#${alias}`).join(", ")}
                </p>
              )}
            </div>
            <button type="button" className="tool-button" onClick={() => onToggle(tag)}>
              <Power size={16} aria-hidden="true" />
              {tag.status === "active" ? "Disable" : "Enable"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
