import { useEffect } from "react";

import { useSocialSocketEvents } from "@/hooks/useSocialSocketEvents";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { initSystemNotifications } from "@/utils/localSystemNotification";

/** Socket thông báo xã hội + đăng ký push — gắn ở `(main)`. */
export function SocialSocketBootstrap() {
  const socialSocketOverlay = useSocialSocketEvents();
  usePushNotifications();

  useEffect(() => {
    void initSystemNotifications();
  }, []);

  return <>{socialSocketOverlay}</>;
}
