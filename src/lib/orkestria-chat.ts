import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createThread,
  deleteThread,
  listThreads,
  sendChatMessage,
} from "@/functions/chat";
import { asMs } from "@/lib/time";

export type ChatToolCall = {
  name: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
};

export type ChatMsg = {
  id: string;
  role: "user" | "agent";
  text: string;
  tools?: ChatToolCall[];
  createdAt: number;
};

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMsg[];
};

function mapThread(t: Awaited<ReturnType<typeof listThreads>>[number]): ChatThread {
  return {
    id: t.id,
    title: t.title ?? "Nouvelle conversation",
    updatedAt: asMs(t.updatedAt),
    messages: t.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "agent",
      text: m.text,
      tools: (m.tools as ChatToolCall[] | null) ?? undefined,
      createdAt: asMs(m.createdAt),
    })),
  };
}

export function useOrkestriaChat(activeId: string | null, onActiveId: (id: string) => void) {
  const qc = useQueryClient();
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["orkestria-chat"],
    queryFn: async () => {
      const rows = await listThreads();
      if (rows.length === 0) {
        const created = await createThread();
        return created.map(mapThread);
      }
      return rows.map(mapThread);
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["orkestria-chat"] });

  const activeThreadId =
    activeId && threads.some((t) => t.id === activeId) ? activeId : (threads[0]?.id ?? null);

  const createMut = useMutation({
    mutationFn: () => createThread(),
    onSuccess: (rows) => {
      invalidate();
      const mapped = rows.map(mapThread);
      if (mapped[0]) onActiveId(mapped[0].id);
    },
  });

  const sendMut = useMutation({
    mutationFn: ({ threadId, text }: { threadId: string; text: string }) =>
      sendChatMessage({ data: { threadId, text } }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteThread({ data: { id } }),
    onSuccess: (rows) => {
      invalidate();
      const mapped = rows.map(mapThread);
      onActiveId(mapped[0]?.id ?? "");
    },
  });

  return {
    threads,
    isLoading,
    activeThreadId,
    isSending: sendMut.isPending,
    createThread: () => createMut.mutateAsync(),
    sendMessage: (threadId: string, text: string) => sendMut.mutateAsync({ threadId, text }),
    deleteThread: (id: string) => deleteMut.mutate(id),
    setThreadsLocal: (_threads: ChatThread[], _activeId: string) => {
      void _threads;
      void _activeId;
    },
  };
}
