import { useLocalSearchParams } from "expo-router";
import { CommunityDetail } from "@/features/communities/components/CommunityDetail";

export default function CommunityDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  if (!groupId) return null;

  return <CommunityDetail groupId={groupId} />;
}
