import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, Vibration, ImageBackground } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Users, Globe, Lock, ArrowLeft, CheckCircle } from "lucide-react-native";

import { useAppSelector } from "@/hooks/useAppStore";
import {
  useGetCommunityByInviteCodeQuery,
  useAcceptInviteLinkMutation,
} from "@/store/api/communityApi";
import { Avatar } from "@/components/common/Avatar";
import { toast } from "@/utils/appToast";

export default function JoinCommunityScreen() {
  const { inviteCode: rawInviteCode } = useLocalSearchParams<{ inviteCode: string | string[] }>();
  const inviteCode = useMemo(() => {
    const code = Array.isArray(rawInviteCode) ? rawInviteCode[0] : rawInviteCode;
    return String(code ?? "")
      .trim()
      .toLowerCase();
  }, [rawInviteCode]);

  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  const {
    data: community,
    isLoading,
    isError,
    error,
  } = useGetCommunityByInviteCodeQuery(inviteCode, { skip: !inviteCode });

  const [acceptInvite, { isLoading: joining }] = useAcceptInviteLinkMutation();
  const [joinSuccess, setJoinSuccess] = useState(false);

  const isAlreadyMember = community?.viewerRole !== null && community?.viewerRole !== undefined;

  const loginThenJoin = () => {
    router.push({
      pathname: "/(auth)/login",
      params: { redirect: `/c/join/${inviteCode}` },
    });
  };

  const handleJoin = async () => {
    if (!inviteCode) return;
    if (!isAuthenticated) {
      loginThenJoin();
      return;
    }
    try {
      await acceptInvite(inviteCode).unwrap();
      setJoinSuccess(true);
      Vibration.vibrate(80);
      toast.success("Gia nhập cộng đồng thành công!");
      setTimeout(() => {
        router.replace(`/(main)/(communities)/${community?.groupId}`);
      }, 1500);
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể gia nhập cộng đồng này");
    }
  };

  if (!inviteCode) {
    return (
      <JoinShell>
        <Text className="text-center text-base font-semibold text-muted-foreground">
          Liên kết mời không hợp lệ
        </Text>
      </JoinShell>
    );
  }

  if (isLoading) {
    return (
      <JoinShell>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-3 animate-pulse text-sm font-semibold text-muted-foreground">
          Đang xác thực liên kết mời…
        </Text>
      </JoinShell>
    );
  }

  if (isError || !community) {
    const errMsg =
      (error as any)?.data?.message || "Đường liên kết mời này đã hết hạn hoặc không tồn tại.";
    return (
      <JoinShell>
        <View className="w-full max-w-sm items-center rounded-3xl border border-red-500/10 bg-red-500/5 p-6">
          <Text className="text-center text-lg font-bold text-foreground">
            Liên kết không hợp lệ
          </Text>
          <Text className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
            {errMsg}
          </Text>
          <Pressable
            className="mt-6 w-full flex-row items-center justify-center gap-1.5 rounded-2xl bg-foreground py-3 active:opacity-90"
            onPress={() => router.replace("/")}
          >
            <ArrowLeft size={16} color="#FFF" />
            <Text className="text-center text-sm font-bold text-background">Về trang chủ</Text>
          </Pressable>
        </View>
      </JoinShell>
    );
  }

  return (
    <JoinShell>
      <View className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Cover image area */}
        <View className="relative h-32 bg-primary/10">
          {community.coverUrl ? (
            <ImageBackground
              source={{ uri: community.coverUrl }}
              className="h-full w-full"
              blurRadius={1.5}
            />
          ) : (
            <View className="h-full w-full bg-gradient-to-r from-blue-600 to-indigo-700 opacity-80" />
          )}
          <Pressable
            onPress={() => router.replace("/")}
            className="absolute left-4 top-4 size-8 items-center justify-center rounded-full bg-black/30 active:bg-black/50"
          >
            <ArrowLeft size={16} color="#FFF" />
          </Pressable>
        </View>

        {/* Content Section */}
        <View className="items-center px-5 pb-6">
          {/* Overlapping Avatar */}
          <View className="z-10 -mt-10 size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-card shadow-md">
            <Avatar uri={community.avatar} name={community.name} size="lg" />
          </View>

          <Text className="mt-3 inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold capitalize text-blue-600 dark:text-blue-400">
            {community.category}
          </Text>

          <Text
            className="mt-1 px-1 text-center text-xl font-bold text-foreground"
            numberOfLines={2}
          >
            {community.name}
          </Text>

          <View className="mt-3 flex-row items-center gap-3">
            <View className="flex-row items-center gap-1 rounded-lg bg-muted px-2 py-0.5">
              <Users size={12} color="#3B82F6" />
              <Text className="text-[10px] font-bold text-muted-foreground">
                {community.memberCount.toLocaleString("vi-VN")} thành viên
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-lg bg-muted px-2 py-0.5">
              {community.type === "public" ? (
                <>
                  <Globe size={12} color="#10B981" />
                  <Text className="text-[10px] font-bold text-muted-foreground">Công khai</Text>
                </>
              ) : (
                <>
                  <Lock size={12} color="#F59E0B" />
                  <Text className="text-[10px] font-bold text-muted-foreground">Riêng tư</Text>
                </>
              )}
            </View>
          </View>

          <View className="mt-4 min-h-[70px] w-full rounded-2xl border border-border/40 bg-muted/40 p-3.5">
            <Text className="text-xs leading-relaxed text-muted-foreground" numberOfLines={3}>
              {community.description ||
                "Không có mô tả cho cộng đồng này. Mời bạn tham gia để cùng kết nối."}
            </Text>
          </View>

          <View className="mt-5 w-full">
            {joinSuccess ? (
              <View className="w-full flex-row items-center justify-center gap-1.5 rounded-2xl border border-green-500/20 bg-green-500/10 py-3">
                <CheckCircle size={16} color="#10B981" />
                <Text className="text-sm font-bold text-green-600 dark:text-green-400">
                  Gia nhập thành công!
                </Text>
              </View>
            ) : isAlreadyMember ? (
              <Pressable
                className="w-full rounded-2xl bg-primary py-3 active:opacity-90"
                onPress={() => router.replace(`/(main)/(communities)/${community.groupId}`)}
              >
                <Text className="text-center text-sm font-bold text-primary-foreground">
                  Bạn đã là thành viên - Vào nhóm
                </Text>
              </Pressable>
            ) : (
              <Pressable
                className="w-full items-center justify-center rounded-2xl bg-primary py-3 active:opacity-90"
                disabled={joining}
                onPress={() => void handleJoin()}
              >
                {joining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-center text-sm font-bold text-primary-foreground">
                    {!isAuthenticated ? "Đăng nhập để gia nhập" : "Chấp nhận lời mời & Gia nhập"}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-background px-6">{children}</View>;
}
