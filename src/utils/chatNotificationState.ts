import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { chatNotificationId, clearChatNotificationStack } from "@/utils/chatNotificationStack";

export function clearConversationNotificationState(conversationId: string): void {
  const cid = conversationId.trim();
  if (!cid || Platform.OS === "web") return;

  clearChatNotificationStack(cid);
  void Notifications.dismissNotificationAsync(chatNotificationId(cid)).catch(() => undefined);
}
