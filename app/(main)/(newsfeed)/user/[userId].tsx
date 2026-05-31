import { useLocalSearchParams } from "expo-router";

import { PublicProfilePage } from "@/features/profile/components/PublicProfilePage";

export default function PublicProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  return <PublicProfilePage userId={String(userId ?? "")} />;
}
