import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { useGroupJoinLinkModalOptional } from "@/contexts/GroupJoinLinkModalContext";

import { Avatar } from "@/components/common/Avatar";
import {
  joinLinkMessageDomain,
  type GroupJoinLinkMessagePayload,
} from "@/utils/groupJoinLinkMessage";

const PRIMARY = "#0068FF";

type GroupJoinLinkCardProps = {
  payload: GroupJoinLinkMessagePayload;
};

/** Thẻ preview link mời — đồng bộ web (sky + #0068FF). */
export function GroupJoinLinkCard({ payload }: GroupJoinLinkCardProps) {
  const joinLinkModal = useGroupJoinLinkModalOptional();
  const domain = joinLinkMessageDomain(payload.url);

  const openLink = () => {
    if (joinLinkModal) {
      joinLinkModal.openFromPayload(payload);
      return;
    }
    router.push(`/join/${payload.suffix}`);
  };

  return (
    <Pressable
      onPress={openLink}
      accessibilityRole="link"
      accessibilityLabel={`Mở link tham gia nhóm: ${payload.url}`}
      className="w-full min-w-[260px] max-w-full overflow-hidden rounded-xl border border-sky-200 bg-sky-50 active:border-[#0068ff]/40 active:bg-sky-100/90"
      style={({ pressed }) => ({
        borderColor: pressed ? "rgba(0, 104, 255, 0.45)" : "#BAE6FD",
        shadowColor: pressed ? PRIMARY : "transparent",
        shadowOpacity: pressed ? 0.12 : 0,
        shadowRadius: pressed ? 6 : 0,
        shadowOffset: { width: 0, height: 2 },
      })}
    >
      {({ pressed }) => (
        <>
          <View
            className="border-b border-sky-100 px-3 py-2"
            style={{
              backgroundColor: pressed ? "rgba(0, 104, 255, 0.06)" : "rgba(240, 249, 255, 0.9)",
              borderBottomColor: pressed ? "rgba(0, 104, 255, 0.2)" : "#E0F2FE",
            }}
          >
            <Text
              className="font-mono text-[12px]"
              style={{
                color: PRIMARY,
                textDecorationLine: pressed ? "underline" : "none",
              }}
              numberOfLines={1}
            >
              {payload.url}
            </Text>
          </View>
          <View className="flex-row items-start gap-3 px-3 py-3">
            <Avatar uri={payload.groupAvatar} name={payload.groupName} size="lg" isGroup />
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-bold text-slate-900" numberOfLines={2}>
                {payload.groupName}
              </Text>
              <Text className="mt-1.5 text-[13px] leading-snug text-slate-600" numberOfLines={3}>
                {payload.description ?? "Bấm vào đây để tham gia nhóm trên HamTech"}
              </Text>
              <Text className="mt-2 text-[12px] font-medium text-slate-500">{domain}</Text>
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}
