import { useSocialSocketEvents } from "@/hooks/useSocialSocketEvents";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/** Socket thông báo xã hội + đăng ký push — gắn ở `(main)`. */
export function SocialSocketBootstrap() {
  const socialSocketOverlay = useSocialSocketEvents();
  usePushNotifications();
  return <>{socialSocketOverlay}</>;
}
