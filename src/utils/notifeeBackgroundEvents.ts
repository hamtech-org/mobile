import { handleNotificationResponseAction } from "@/utils/notificationResponseActions";
import { registerNotifeeBackgroundEvents } from "@/utils/notifeeSystemNotification";

registerNotifeeBackgroundEvents(async (response) => {
  try {
    await handleNotificationResponseAction(response);
  } catch {
    /* background action best effort */
  }
});
