import { Stack, useSegments } from "expo-router";
import { useMemo } from "react";
import { useAppDispatch } from "@/hooks/useAppStore";
import { useSocket } from "@/hooks/useSocket";
import { useConversationRoomSync } from "@/hooks/useConversationRoomSync";
import { useChatRealtimeEvents } from "@/hooks/useChatRealtimeEvents";

export default function ChatLayout() {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const segments = useSegments();
  const activeConversationId = useMemo(() => {
    const maybeId = segments[segments.length - 1];
    if (!maybeId || maybeId === "(chat)" || maybeId === "index") {
      return null;
    }
    return maybeId;
  }, [segments]);

  useConversationRoomSync({ socket });
  useChatRealtimeEvents({ dispatch, socket, activeConversationId });

  return <Stack screenOptions={{ headerShown: false }} />;
}
