import type { IMessage } from "@/types/chat.types";

export const QUICK_REACT_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "😡"] as const;

export function canPinMessage(msg: IMessage): boolean {
  if (msg.isDeleted || msg.isRecalled) return false;
  if (msg.type === "system") return false;
  return true;
}
