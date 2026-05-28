import { useEffect, useMemo, useRef } from "react";

import { useAppDispatch } from "@/hooks/useAppStore";
import { taskApi } from "@/store/api/endpoints/taskApi";
import type { IConversation } from "@/types/chat.types";
import AsyncStorage from "@react-native-async-storage/async-storage";

type GroupTaskLike = {
  taskId: string;
  title: string;
  status?: "todo" | "in_progress" | "done";
  dueDate?: string | null;
  assignees?: string[];
  assignToAll?: boolean;
  subtasks?: { assigneeId: string; done?: boolean }[];
};

function isTaskRelevantToUser(task: GroupTaskLike, currentUserId: string): boolean {
  const uid = String(currentUserId);
  const assignees = Array.isArray(task.assignees) ? task.assignees.map(String) : [];
  const assignToAll = Boolean(task.assignToAll) || assignees.length === 0;
  const subs = Array.isArray(task.subtasks) ? task.subtasks : [];

  if (subs.length > 0) {
    const ids = Array.from(new Set(subs.map((s) => String(s.assigneeId ?? "")).filter(Boolean)));
    return ids.includes(uid);
  }
  return assignToAll ? true : assignees.includes(uid);
}

export function useDueTaskNotifications({
  conversations,
  currentUserId,
  pollIntervalMs = 30_000,
}: {
  conversations: IConversation[];
  currentUserId: string;
  pollIntervalMs?: number;
}) {
  const dispatch = useAppDispatch();
  const inFlightRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const groupIds = useMemo(
    () =>
      (conversations ?? [])
        .filter((c) => c.type === "group")
        .map((c) => String(c.conversationId))
        .filter(Boolean),
    [conversations],
  );

  useEffect(() => {
    if (!currentUserId) return;
    if (!groupIds.length) return;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const now = Date.now();

        for (const gid of groupIds) {
          const res = await dispatch(
            taskApi.endpoints.getTasks.initiate(gid, { subscribe: false, forceRefetch: false }),
          );
          const data = (res as { data?: { data?: GroupTaskLike[] } })?.data?.data;
          if (!Array.isArray(data) || data.length === 0) continue;

          for (const task of data) {
            if (!task?.taskId) continue;
            if (task.status === "done") continue;
            if (!isTaskRelevantToUser(task, currentUserId)) continue;

            const dueRaw = String(task.dueDate ?? "").trim();
            const dueMs = dueRaw ? new Date(dueRaw).getTime() : NaN;
            if (!Number.isFinite(dueMs)) continue;

            const delta = now - dueMs;
            if (delta < 0 || delta > pollIntervalMs + 5_000) continue;

            const toastKey = `task_due:${gid}:${String(task.taskId)}`;
            const persistedKey = `reminder_sent:${toastKey}`;
            if (seenRef.current.has(toastKey)) continue;

            const persisted = await AsyncStorage.getItem(persistedKey);
            if (persisted === "1") {
              seenRef.current.add(toastKey);
              continue;
            }

            try {
              await dispatch(
                taskApi.endpoints.triggerTaskDueReminder.initiate({
                  groupId: gid,
                  taskId: String(task.taskId),
                }),
              );
            } catch {
              /* ignore */
            }

            seenRef.current.add(toastKey);
            await AsyncStorage.setItem(persistedKey, "1");
          }
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const interval = Math.max(10_000, pollIntervalMs);
    const t = setInterval(() => void tick(), interval);
    void tick();
    return () => clearInterval(t);
  }, [currentUserId, dispatch, groupIds, pollIntervalMs]);
}
