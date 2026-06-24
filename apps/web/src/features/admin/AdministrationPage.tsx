import type { AdminTag, CreateAdminTagInput } from "@doomscrollr/shared/types.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge, Plus, Power } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { adminAction, ApiError, createAdminTag, fetchAdminTags } from "../../app/api.ts";
import { AdminShell, AdminTabs } from "./admin-nav.tsx";

// Administration: curate the fixed tag set users choose from. Three separate
// tools — create, merge, enable/disable — instead of one crammed control.
export function AdministrationPage() {
  const { t } = useTranslation();
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

  if (!signedIn) return <AdminShell message={t("admin.shell.signIn")} />;
  if (tagsQuery.isPending) return <AdminShell message={t("admin.shell.loadingTags")} />;
  if (tagsQuery.isError) {
    const message = tagsQuery.error instanceof ApiError && tagsQuery.error.status === 403
      ? t("admin.shell.accessRequired")
      : t("admin.shell.loadTagsError");
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
          <p className="meta-label">{t("admin.tags.eyebrow")}</p>
          <h1 className="mobile-title admin-workbench__title">{t("admin.tags.title")}</h1>
          <p className="admin-workbench__summary">{t("admin.tags.summary")}</p>
        </div>
        <dl className="admin-case-tape" aria-label="Tag set summary">
          <div className="admin-case-tape__item admin-case-tape__item--open">
            <dt>{t("admin.tags.tape.active")}</dt>
            <dd>{activeCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>{t("admin.tags.tape.disabled")}</dt>
            <dd>{disabledCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>{t("admin.tags.tape.total")}</dt>
            <dd>{tags.length}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>{t("admin.tags.tape.aliases")}</dt>
            <dd>{aliasCount}</dd>
          </div>
        </dl>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <section className="hard-panel admin-tool" aria-labelledby="admin-create-title">
        <div className="admin-panel-heading">
          <div>
            <p className="meta-label">{t("admin.tags.createEyebrow")}</p>
            <h2 id="admin-create-title" className="admin-section-title">
              {t("admin.tags.createTitle")}
            </h2>
            <p className="admin-panel-copy">{t("admin.tags.createCopy")}</p>
          </div>
        </div>
        <CreateTagTool onCreate={createTag} />
      </section>

      <section className="hard-panel admin-tool" aria-labelledby="admin-merge-title">
        <div className="admin-panel-heading">
          <div>
            <p className="meta-label">{t("admin.tags.mergeEyebrow")}</p>
            <h2 id="admin-merge-title" className="admin-section-title">
              {t("admin.tags.mergeTitle")}
            </h2>
            <p className="admin-panel-copy">{t("admin.tags.mergeCopy")}</p>
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
            <p className="meta-label">{t("admin.tags.manageEyebrow")}</p>
            <h2 id="admin-manage-title" className="admin-section-title">
              {t("admin.tags.manageTitle")}
            </h2>
            <p className="admin-panel-copy">{t("admin.tags.manageCopy")}</p>
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
  const { t } = useTranslation();
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
        <span>{t("admin.tags.slug")}</span>
        <input
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
          placeholder="wholesome-chaos"
          aria-label={t("admin.tags.slug")}
          className="field-control admin-mono-field"
          required
        />
      </label>
      <label className="admin-filter">
        <span>{t("admin.tags.name")}</span>
        <input
          value={form.displayName}
          onChange={(event) =>
            setForm((current) => ({ ...current, displayName: event.target.value }))}
          placeholder={t("admin.tags.namePlaceholder")}
          aria-label={t("admin.tags.name")}
          className="field-control"
          required
        />
      </label>
      <label className="admin-filter">
        <span>{t("admin.tags.note")}</span>
        <input
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder={t("admin.tags.optional")}
          aria-label={t("admin.tags.note")}
          className="field-control"
        />
      </label>
      <button type="submit" className="tool-button bg-signal text-pitch">
        <Plus size={16} aria-hidden="true" />
        {t("admin.tags.create")}
      </button>
    </form>
  );
}

function MergeTagsTool(
  { tags, onMerge }: { tags: AdminTag[]; onMerge: (source: string, target: string) => void },
) {
  const { t } = useTranslation();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const sourceSelectRef = useRef<HTMLSelectElement>(null);

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
    globalThis.requestAnimationFrame(() => sourceSelectRef.current?.focus());
  }

  function closeConfirmation() {
    setConfirming(false);
    globalThis.requestAnimationFrame(() => reviewButtonRef.current?.focus());
  }

  function trapConfirmationKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      confirmDialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), " +
          'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;

    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    if (activeIndex === -1) return;

    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = (activeIndex + direction + focusable.length) % focusable.length;
    focusable[nextIndex].focus();
  }

  function cycleConfirmationButtonFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();

    if (event.currentTarget === cancelButtonRef.current) {
      mergeButtonRef.current?.focus();
      return;
    }

    cancelButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!confirming) return;
    const frame = globalThis.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => globalThis.cancelAnimationFrame(frame);
  }, [confirming]);

  if (tags.length < 2) {
    return <p className="admin-tool__empty">{t("admin.tags.needTwo")}</p>;
  }

  return (
    <div className="admin-merge">
      <div className="admin-merge__sentence">
        <span className="admin-merge__word">{t("admin.tags.mergeWord")}</span>
        <select
          ref={sourceSelectRef}
          className="field-control admin-mono-field"
          aria-label="Tag to absorb"
          value={source}
          onChange={(event) => pickSource(event.currentTarget.value)}
        >
          <option value="">{t("admin.tags.chooseTag")}</option>
          {tags.map((tag) => (
            <option key={tag.slug} value={tag.slug}>
              #{tag.slug} · {t("admin.tags.posts", { count: tag.postCount })}
            </option>
          ))}
        </select>
        <span className="admin-merge__word">{t("admin.tags.into")}</span>
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
          <option value="">{t("admin.tags.chooseTag")}</option>
          {targetOptions.map((tag) => <option key={tag.slug} value={tag.slug}>#{tag.slug}</option>)}
        </select>
      </div>

      {confirming && sourceTag
        ? (
          <div
            ref={confirmDialogRef}
            className="admin-merge-confirm"
            role="alertdialog"
            aria-labelledby="admin-merge-confirm-title"
            aria-describedby="admin-merge-confirm-detail"
            onKeyDownCapture={trapConfirmationKeys}
          >
            <p id="admin-merge-confirm-title" className="admin-merge-confirm__q">
              {t("admin.tags.confirmQ", { source, target })}
            </p>
            <p id="admin-merge-confirm-detail" className="admin-merge-confirm__detail">
              {t("admin.tags.confirmDetail", { count: sourceTag.postCount, source, target })}
            </p>
            <div className="admin-merge-confirm__actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="tool-button"
                onClick={closeConfirmation}
                onKeyDown={cycleConfirmationButtonFocus}
              >
                {t("admin.tags.cancel")}
              </button>
              <button
                ref={mergeButtonRef}
                type="button"
                className="tool-button admin-danger-button"
                onClick={confirmMerge}
                onKeyDown={cycleConfirmationButtonFocus}
              >
                <GitMerge size={16} aria-hidden="true" />
                {t("admin.tags.mergeTags")}
              </button>
            </div>
          </div>
        )
        : (
          <button
            ref={reviewButtonRef}
            type="button"
            className="tool-button"
            disabled={!canReview}
            onClick={() => setConfirming(true)}
          >
            <GitMerge size={16} aria-hidden="true" />
            {t("admin.tags.review")}
          </button>
        )}
    </div>
  );
}

function ManageTagsTool(
  { tags, onToggle }: { tags: AdminTag[]; onToggle: (tag: AdminTag) => void },
) {
  const { t } = useTranslation();
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
                <span>{t("admin.tags.posts", { count: tag.postCount })}</span>
              </div>
              {tag.aliases.length > 0 && (
                <p className="admin-tag-row__aliases">
                  {t("admin.tags.aliases", {
                    list: tag.aliases.map((alias) => `#${alias}`).join(", "),
                  })}
                </p>
              )}
            </div>
            <button
              type="button"
              className="tool-button"
              onClick={() =>
                onToggle(tag)}
            >
              <Power size={16} aria-hidden="true" />
              {tag.status === "active" ? t("admin.tags.disable") : t("admin.tags.enable")}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
