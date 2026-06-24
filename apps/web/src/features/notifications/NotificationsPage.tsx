import type { Notification } from "@doomscrollr/shared/types.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AtSign, Bell, CheckCheck, MessageCircle, ShieldCheck } from "lucide-react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../app/api.ts";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationsPage() {
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
        <p className="meta-label">Notifications</p>
        <h1 className="mobile-title mt-1">Sign in to view your inbox</h1>
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
          <p className="meta-label">Notifications</p>
          <h1 className="mobile-title">Inbox</h1>
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
          <p className="meta-label">Notifications</p>
          <h1 className="mobile-title">Inbox</h1>
        </div>
        <button
          type="button"
          className="tool-button"
          disabled={unreadCount === 0 || markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
        >
          <CheckCheck aria-hidden="true" size={17} />
          Mark all read
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
  return (
    <div className="hard-panel notification-empty">
      <Bell aria-hidden="true" size={22} strokeWidth={2.3} />
      <p>You don't have any notifications.</p>
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
          <p className="notification-item__title">{titleFor(notification)}</p>
          <time className="meta-label" dateTime={notification.createdAt}>
            {dateFormatter.format(new Date(notification.createdAt))}
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
              Open
            </Link>
          )}
          {isUnread && (
            <button
              type="button"
              className="tool-button"
              disabled={isMarkingRead}
              onClick={onRead}
            >
              Mark read
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

function titleFor(notification: Notification): string {
  if (notification.type === "moderation_outcome") {
    const targetType = metadataString(notification.metadata, "targetType") === "comment"
      ? "comment"
      : "post";
    const action = metadataString(notification.metadata, "action") === "restored"
      ? "restored"
      : "removed";
    return `Your ${targetType} was ${action}`;
  }

  const actor = notification.actor ? `@${notification.actor.username}` : "Someone";
  if (notification.type === "comment_reply") return `${actor} replied to your comment`;
  if (notification.type === "mention") return `${actor} mentioned you`;
  return `${actor} replied to your post`;
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
