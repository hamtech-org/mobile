import { useSocialSocketEvents } from "@/hooks/useSocialSocketEvents";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/** Socket thông báo xã hội + đăng ký push — gắn ở `(main)`. */
export function SocialSocketBootstrap(): null {
  useSocialSocketEvents();
  usePushNotifications();
  return null;
}
