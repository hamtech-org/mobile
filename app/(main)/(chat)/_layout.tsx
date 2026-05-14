import { Stack } from "expo-router";
import { CalendarClockProvider } from "@/contexts/CalendarClockContext";

export default function ChatLayout() {
  return (
    <CalendarClockProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CalendarClockProvider>
  );
}
