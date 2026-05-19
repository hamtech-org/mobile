import { useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Users } from "lucide-react-native";

import { useAppSelector } from "@/hooks/useAppStore";
import {
  useGetGroupJoinPreviewQuery,
  useJoinGroupViaLinkMutation,
} from "@/store/api/endpoints/joinApi";
import { Avatar } from "@/components/common/Avatar";
import { toast } from "@/utils/appToast";

export default function JoinGroupScreen() {
  const { suffix: rawSuffix } = useLocalSearchParams<{ suffix: string | string[] }>();
  const suffix = useMemo(() => {
    const s = Array.isArray(rawSuffix) ? rawSuffix[0] : rawSuffix;
    return String(s ?? "")
      .trim()
      .toLowerCase();
  }, [rawSuffix]);

  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  const {
    data: preview,
    isLoading,
    isError,
  } = useGetGroupJoinPreviewQuery(suffix, { skip: !suffix });

  const [joinViaLink, { isLoading: joining }] = useJoinGroupViaLinkMutation();

  const loginThenJoin = () => {
    router.push({
      pathname: "/(auth)/login",
      params: { redirect: `/join/${suffix}` },
    });
  };

  const handleJoin = async () => {
    if (!suffix) return;
    if (!isAuthenticated) {
      loginThenJoin();
      return;
    }
    try {
      const result = await joinViaLink(suffix).unwrap();
      if (result.status === "joined" || result.status === "already_member") {
        router.replace(`/(main)/(chat)/${result.conversationId}`);
        return;
      }
      if (result.status === "pending") {
        toast.success("Đã gửi yêu cầu — chờ trưởng nhóm duyệt");
      }
    } catch {
      toast.error("Không thể tham gia nhóm");
    }
  };

  if (!suffix) {
    return (
      <JoinShell>
        <Text className="text-center text-base text-muted-foreground">Link không hợp lệ</Text>
      </JoinShell>
    );
  }

  if (isLoading) {
    return (
      <JoinShell>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-3 text-muted-foreground">Đang tải…</Text>
      </JoinShell>
    );
  }

  if (isError || !preview) {
    return (
      <JoinShell>
        <Text className="text-center text-lg font-semibold text-foreground">Link không hợp lệ</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Link đã hết hạn hoặc nhóm đã tắt tham gia bằng link.
        </Text>
        <Pressable
          className="mt-6 rounded-xl bg-primary px-6 py-3 active:opacity-90"
          onPress={() => router.replace("/(main)/(chat)")}
        >
          <Text className="text-center font-semibold text-white">Về tin nhắn</Text>
        </Pressable>
      </JoinShell>
    );
  }

  return (
    <JoinShell>
      <View className="w-full max-w-sm items-center gap-4">
        <Avatar uri={preview.avatar} name={preview.name} size="xl" isGroup />

        <Text className="text-center text-2xl font-bold text-foreground">{preview.name}</Text>
        <View className="flex-row items-center gap-1.5">
          <Users size={16} color="#64748b" />
          <Text className="text-sm text-muted-foreground">{preview.memberCount} thành viên</Text>
        </View>

        {preview.isMember ? (
          <Pressable
            className="mt-4 w-full rounded-xl bg-primary py-3.5 active:opacity-90"
            onPress={() => router.replace(`/(main)/(chat)/${preview.conversationId}`)}
          >
            <Text className="text-center font-semibold text-white">Mở nhóm chat</Text>
          </Pressable>
        ) : preview.requestStatus === "pending" ? (
          <Text className="mt-2 text-center text-sm text-amber-600">Yêu cầu đang chờ duyệt.</Text>
        ) : (
          <View className="mt-2 w-full gap-2">
            {preview.approvalRequired ? (
              <Text className="text-center text-sm text-muted-foreground">
                Nhóm yêu cầu phê duyệt trước khi tham gia.
              </Text>
            ) : null}
            <Pressable
              className="w-full rounded-xl bg-primary py-3.5 active:opacity-90"
              disabled={joining}
              onPress={() => void handleJoin()}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-center font-semibold text-white">
                  {!isAuthenticated
                    ? "Đăng nhập để tham gia"
                    : preview.approvalRequired
                      ? "Gửi yêu cầu tham gia"
                      : "Tham gia nhóm"}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-background px-6">{children}</View>;
}
