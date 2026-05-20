import { Stack } from "expo-router";
import { CalendarClockProvider } from "@/contexts/CalendarClockContext";
import { GroupJoinLinkModalProvider } from "@/contexts/GroupJoinLinkModalContext";

export default function ChatLayout() {
  return (
    <CalendarClockProvider>
      <GroupJoinLinkModalProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </GroupJoinLinkModalProvider>
    </CalendarClockProvider>
  );
}
