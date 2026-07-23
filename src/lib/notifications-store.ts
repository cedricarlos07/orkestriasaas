import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/functions/notifications";
import { asMs } from "@/lib/time";

export type Notification = {
  id: string;
  kind: "approval" | "status" | "info" | string;
  title: string;
  body: string;
  createdAt: Date | number;
  read: boolean | null;
  emailSent: boolean | null;
};

function mapNotification(n: Awaited<ReturnType<typeof listNotifications>>[number]): Notification {
  return {
    id: n.id,
    kind: n.kind as Notification["kind"],
    title: n.title,
    body: n.body,
    createdAt: asMs(n.createdAt),
    read: n.read,
    emailSent: n.emailSent,
  };
}

export function timeAgo(ts: number | Date | string) {
  const t = asMs(ts);
  if (!t) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export function useNotifications() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await listNotifications()).map(mapNotification),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const markReadMut = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: invalidate,
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  const unread = list.filter((n) => !n.read).length;

  return {
    list,
    unread,
    markRead: (id: string) => markReadMut.mutate(id),
    markAllRead: () => markAllMut.mutate(),
  };
}
