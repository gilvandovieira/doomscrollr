import type { Notification } from "@doomscrollr/shared/types.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { AtSign, Bell, CheckCheck, MessageCircle, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../app/api.ts";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { getLocale } from "../../app/i18n.ts";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const getToken = useAuthToken();
  const isSignedIn = useIsSignedIn();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(getToken),
    enabled: isSignedIn,
    staleTime: 15_000,
  });

  const refreshNotifications = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markOneMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId, getToken),
    onSuccess: refreshNotifications,
  });
  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(getToken),
    onSuccess: refreshNotifications,
  });

  if (!isSignedIn) {
    return (
      <div className="hard-panel p-5">
        <p className="meta-label">{t("notifications.eyebrow")}</p>
        <h1 className="mobile-title mt-1">{t("notifications.signIn")}</h1>
      </div>
    );
  }

  if (notificationsQuery.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading notifications">
        <div className="h-6 w-40 rounded-full bg-newsprint" />
        <div className="hard-panel h-32 animate-pulse bg-newsprint" />
        <div className="hard-panel h-28 animate-pulse bg-newsprint" />
      </div>
    );
  }

  if (notificationsQuery.isError || !notificationsQuery.data) {
    return (
      <section className="space-y-4">
        <div className="px-1">
          <p className="meta-label">{t("notifications.eyebrow")}</p>
          <h1 className="mobile-title">{t("notifications.inbox")}</h1>
        </div>
        <EmptyNotifications />
      </section>
    );
  }

  const { items, unreadCount } = notificationsQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="meta-label">{t("notifications.eyebrow")}</p>
          <h1 className="mobile-title">{t("notifications.inbox")}</h1>
        </div>
        <button
          type="button"
          className="tool-button"
          disabled={unreadCount === 0 || markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
        >
          <CheckCheck aria-hidden="true" size={17} />
          {t("notifications.markAll")}
        </button>
      </div>

      {items.length === 0 ? <EmptyNotifications /> : (
        <div className="notification-list">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={() => markOneMutation.mutate(notification.id)}
              isMarkingRead={markOneMutation.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyNotifications() {
  const { t } = useTranslation();
  return (
    <div className="hard-panel notification-empty">
      <Bell aria-hidden="true" size={22} strokeWidth={2.3} />
      <p>{t("notifications.empty")}</p>
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
  isMarkingRead,
}: {
  notification: Notification;
  onRead: () => void;
  isMarkingRead: boolean;
}) {
  const { t } = useTranslation();
  const isUnread = notification.readAt === null;
  const icon = iconFor(notification.type);
  const body = bodyFor(notification);

  return (
    <article
      className={`hard-panel notification-item ${isUnread ? "notification-item--unread" : ""}`}
    >
      <span className="notification-item__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="notification-item__content">
        <div className="notification-item__head">
          <p className="notification-item__title">{titleFor(notification, t)}</p>
          <time className="meta-label" dateTime={notification.createdAt}>
            {new Intl.DateTimeFormat(getLocale(), DATE_OPTIONS).format(
              new Date(notification.createdAt),
            )}
          </time>
        </div>
        {body && <p className="notification-item__body">{body}</p>}
        <div className="notification-item__actions">
          {notification.postCode && (
            <Link
              to="/p/$postCode"
              params={{ postCode: notification.postCode }}
              className="tool-button"
              onClick={() => {
                if (isUnread) onRead();
              }}
            >
              {t("notifications.open")}
            </Link>
          )}
          {isUnread && (
            <button
              type="button"
              className="tool-button"
              disabled={isMarkingRead}
              onClick={onRead}
            >
              {t("notifications.markRead")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function iconFor(type: Notification["type"]) {
  if (type === "mention") return <AtSign size={18} strokeWidth={2.35} />;
  if (type === "moderation_outcome") return <ShieldCheck size={18} strokeWidth={2.35} />;
  return <MessageCircle size={18} strokeWidth={2.35} />;
}

function titleFor(notification: Notification, t: TFunction): string {
  if (notification.type === "moderation_outcome") {
    const target = metadataString(notification.metadata, "targetType") === "comment"
      ? t("notifications.targetComment")
      : t("notifications.targetPost");
    const restored = metadataString(notification.metadata, "action") === "restored";
    return t(restored ? "notifications.moderationRestored" : "notifications.moderationRemoved", {
      target,
    });
  }

  const actor = notification.actor ? `@${notification.actor.username}` : t("notifications.someone");
  if (notification.type === "comment_reply") return t("notifications.commentReply", { actor });
  if (notification.type === "mention") return t("notifications.mention", { actor });
  return t("notifications.postReply", { actor });
}

function bodyFor(notification: Notification): string | null {
  if (notification.type === "moderation_outcome") {
    return metadataString(notification.metadata, "reason");
  }
  return notification.bodyPreview;
}

function metadataString(
  metadata: Notification["metadata"],
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
