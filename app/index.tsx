import { Redirect } from "expo-router";

import { useAppSelector } from "@/hooks/useAppStore";
import { Loading } from "@/components/common/Loading";

export default function Index() {
  const { isAuthenticated, isBootstrapping } = useAppSelector((state) => state.auth);

  if (isBootstrapping) {
    return <Loading fullScreen message="Đang khởi tạo phiên làm việc..." />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(main)/(chat)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
