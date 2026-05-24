import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColorScheme } from "nativewind";

import { Button } from "@/components/common/Button";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";
import { FaceLivenessWebViewModal } from "@/components/auth/FaceLivenessWebViewModal";
import { useAuth } from "@/hooks/useAuth";
import { useIconColors } from "@/hooks/useIconColors";
import { toast } from "@/utils/appToast";
import {
  useCreateFaceLivenessSessionMutation,
  useDisableFaceLoginMutation,
  useEnableFaceLoginMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  type AuthSessionSummary,
} from "@/store/api/authApi";
import { useGetProfileQuery, useUpdateProfileMutation } from "@/store/api/userApi";

type ProfileDraft = {
  displayName: string;
  bio: string;
  phone: string;
};

type PickedAvatar = {
  uri: string;
  name: string;
  type: string;
};

const PHONE_REGEX = /^(\+84\d{9,10})?$/;

function statusLabel(status?: string | null): string {
  if (status === "online") return "Đang hoạt động";
  if (status === "away") return "Vắng mặt";
  return "Ngoại tuyến";
}

function roleLabel(role?: string | null): string {
  return role === "admin" ? "Quản trị viên" : "Người dùng";
}

function formatSessionLocation(location: AuthSessionSummary["location"]): string {
  if (!location) return "—";
  const parts = [location.city, location.region, location.country].filter(
    (part) => part && String(part).trim(),
  );
  return parts.length ? parts.join(", ") : "—";
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function getSessionStatus(session: AuthSessionSummary): {
  label: string;
  className: string;
  textClassName: string;
} {
  if (session.isRevoked) {
    return {
      label: "Đã thu hồi",
      className: "bg-amber-500/10 border-amber-500/30",
      textClassName: "text-amber-600",
    };
  }
  if (!session.isActive) {
    return {
      label: "Hết hạn",
      className: "bg-muted border-border",
      textClassName: "text-muted-foreground",
    };
  }
  return {
    label: "Đang hoạt động",
    className: "bg-emerald-500/10 border-emerald-500/30",
    textClassName: "text-emerald-600",
  };
}

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { foreground, muted, primary, destructive } = useIconColors();
  const isDark = colorScheme === "dark";

  const {
    data: profileRes,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
    isFetching: profileFetching,
  } = useGetProfileQuery();
  const {
    data: sessionsRes,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
    isFetching: sessionsFetching,
  } = useGetSessionsQuery(undefined, {
    pollingInterval: 45_000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [updateProfile, { isLoading: updating }] = useUpdateProfileMutation();
  const [createFaceLivenessSession, { isLoading: startingLiveness }] =
    useCreateFaceLivenessSessionMutation();
  const [enableFaceLogin, { isLoading: enablingFaceLogin }] = useEnableFaceLoginMutation();
  const [disableFaceLogin, { isLoading: disablingFaceLogin }] = useDisableFaceLoginMutation();
  const [revokeSession, { isLoading: revokingAnySession }] = useRevokeSessionMutation();

  const user = profileRes?.data;
  const [draft, setDraft] = useState<ProfileDraft>({ displayName: "", bio: "", phone: "" });
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [faceLoginEnabled, setFaceLoginEnabled] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [livenessSessionId, setLivenessSessionId] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDraft({
      displayName: user.displayName ?? "",
      bio: user.bio ?? "",
      phone: user.phone ?? "",
    });
    setFaceLoginEnabled(Boolean(user.faceLoginEnabled));
  }, [user]);

  const sessions = useMemo(() => {
    const rows = sessionsRes?.data ?? [];
    return [...rows].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sessionsRes?.data]);

  const avatarUri = avatar?.uri ?? user?.avatar ?? "";
  const initials = (user?.displayName || user?.email || "H").trim().slice(0, 1).toUpperCase();
  const isRefreshing = profileFetching || sessionsFetching;
  const faceBusy = startingLiveness || enablingFaceLogin || disablingFaceLogin;

  const updateDraft = (key: keyof ProfileDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.warning("Cần quyền truy cập thư viện ảnh để đổi avatar");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAvatar({
      uri: asset.uri,
      name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    });
  };

  const submitProfile = async () => {
    const displayName = draft.displayName.trim();
    const bio = draft.bio.trim();
    const phone = draft.phone.trim();

    if (displayName.length < 2) {
      toast.error("Tên hiển thị phải có ít nhất 2 ký tự");
      return;
    }
    if (displayName.length > 50) {
      toast.error("Tên hiển thị không quá 50 ký tự");
      return;
    }
    if (bio.length > 500) {
      toast.error("Bio không quá 500 ký tự");
      return;
    }
    if (!PHONE_REGEX.test(phone)) {
      toast.error("Số điện thoại không hợp lệ, ví dụ: +84901234567");
      return;
    }

    const form = new FormData();
    form.append("displayName", displayName);
    if (bio) form.append("bio", bio);
    if (phone) form.append("phone", phone);
    if (avatar) {
      form.append("file", {
        uri: avatar.uri,
        name: avatar.name,
        type: avatar.type,
      } as unknown as Blob);
    }

    try {
      await updateProfile(form).unwrap();
      setAvatar(null);
      toast.success("Cập nhật hồ sơ thành công");
    } catch (error) {
      const message =
        (error as { data?: { message?: string; error?: { message?: string } } })?.data?.message ??
        (error as { data?: { error?: { message?: string } } })?.data?.error?.message ??
        "Có lỗi xảy ra khi cập nhật hồ sơ";
      toast.error(message);
    }
  };

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  const openEnableFaceLogin = () => {
    setPassword("");
    setPasswordOpen(true);
  };

  const startFaceLoginEnablement = async () => {
    if (!password.trim()) {
      toast.error("Vui lòng nhập mật khẩu");
      return;
    }

    try {
      const res = await createFaceLivenessSession().unwrap();
      setLivenessSessionId(res.sessionId);
      setPasswordOpen(false);
    } catch {
      toast.error("Không thể khởi tạo phiên xác thực khuôn mặt");
    }
  };

  const completeFaceLoginEnablement = async () => {
    if (!livenessSessionId) return;
    try {
      await enableFaceLogin({ password, livenessSessionId }).unwrap();
      setFaceLoginEnabled(true);
      void refetchProfile();
      setPassword("");
      setLivenessSessionId("");
      toast.success("Đăng nhập bằng khuôn mặt đã được bật");
    } catch (error) {
      const message =
        (error as { data?: { message?: string; error?: { message?: string } } })?.data?.message ??
        (error as { data?: { error?: { message?: string } } })?.data?.error?.message ??
        "Có lỗi xảy ra khi bật đăng nhập bằng khuôn mặt";
      toast.error(message);
      setFaceLoginEnabled(false);
      setLivenessSessionId("");
    }
  };

  const cancelFaceLoginEnablement = () => {
    setPassword("");
    setPasswordOpen(false);
    setLivenessSessionId("");
  };

  const handleDisableFaceLogin = async () => {
    try {
      await disableFaceLogin().unwrap();
      setFaceLoginEnabled(false);
      void refetchProfile();
      toast.success("Đăng nhập bằng khuôn mặt đã được tắt");
    } catch {
      toast.error("Có lỗi xảy ra khi tắt đăng nhập bằng khuôn mặt");
    }
  };

  const handleFaceToggle = () => {
    if (faceLoginEnabled) {
      void handleDisableFaceLogin();
      return;
    }
    openEnableFaceLogin();
  };

  const handleRevokeSession = async (session: AuthSessionSummary) => {
    if (!session.isActive || session.isRevoked) return;
    setRevokingSessionId(session.sessionId);
    try {
      await revokeSession(session.sessionId).unwrap();
      toast.success("Đã thu hồi truy cập thiết bị");
      if (session.isCurrent) {
        await logout();
      }
    } catch (error) {
      const message =
        (error as { data?: { message?: string; error?: { message?: string } } })?.data?.message ??
        (error as { data?: { error?: { message?: string } } })?.data?.error?.message ??
        "Không thể thu hồi phiên";
      toast.error(message);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refetchProfile(), refetchSessions()]);
  };

  if (profileLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
        <ActivityIndicator size="large" color={primary} />
        <Text className="mt-3 text-sm text-muted-foreground">Đang tải hồ sơ...</Text>
      </SafeAreaView>
    );
  }

  if (profileError || !user) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Tôi" rightSlot={<NotificationBellButton />} />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color={destructive} />
          <Text className="mt-4 text-center text-lg font-semibold text-foreground">
            Không thể tải thông tin hồ sơ
          </Text>
          <Button label="Thử lại" onPress={() => void refetchProfile()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Tôi" rightSlot={<NotificationBellButton />} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} />}
        >
          <View className="mb-5">
            <Text className="text-2xl font-bold text-foreground">Quản lý hồ sơ</Text>
            <Text className="mt-1 text-sm leading-5 text-muted-foreground">
              Chỉnh sửa thông tin cá nhân và tùy chỉnh hồ sơ của bạn.
            </Text>
          </View>

          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <View className="h-28 bg-primary" />
            <View className="items-center px-5 pb-5">
              <Pressable
                onPress={pickAvatar}
                className="-mt-16 size-32 items-center justify-center rounded-full border-4 border-background bg-muted active:opacity-85"
                accessibilityLabel="Đổi avatar"
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} className="size-full rounded-full" />
                ) : (
                  <Text className="text-4xl font-bold text-primary">{initials}</Text>
                )}
                <View className="absolute bottom-1 right-1 size-9 items-center justify-center rounded-full bg-primary">
                  <Ionicons name="camera" size={18} color="#fff" />
                </View>
              </Pressable>
              <Text className="mt-3 text-xl font-bold text-foreground" numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>

          <View className="mt-4 gap-4 rounded-2xl border border-border bg-card p-4">
            <ProfileInput
              icon="mail-outline"
              label="Email"
              value={user.email}
              editable={false}
              muted={muted}
              foreground={foreground}
            />
            <ProfileInput
              icon="person-outline"
              label="Tên hiển thị"
              value={draft.displayName}
              onChangeText={(value) => updateDraft("displayName", value)}
              placeholder="Nhập tên hiển thị của bạn"
              muted={muted}
              foreground={foreground}
            />
            <ProfileInput
              icon="document-text-outline"
              label="Tiểu sử"
              value={draft.bio}
              onChangeText={(value) => updateDraft("bio", value)}
              placeholder="Viết một tiểu sử ngắn về bản thân..."
              multiline
              maxLength={500}
              muted={muted}
              foreground={foreground}
              footer={`${draft.bio.length}/500 ký tự`}
            />
            <ProfileInput
              icon="call-outline"
              label="Số điện thoại"
              value={draft.phone}
              onChangeText={(value) => updateDraft("phone", value)}
              placeholder="+84901234567"
              keyboardType="phone-pad"
              muted={muted}
              foreground={foreground}
            />

            <View className="flex-row gap-3">
              <InfoPill
                label="Trạng thái"
                value={statusLabel(user.status)}
                dotClassName={
                  user.status === "online"
                    ? "bg-emerald-500"
                    : user.status === "away"
                      ? "bg-amber-500"
                      : "bg-muted-foreground"
                }
              />
              <InfoPill label="Loại tài khoản" value={roleLabel(user.role)} />
            </View>

            <View className="rounded-xl bg-muted/40 p-3">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={user.isVerified ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={user.isVerified ? "#10b981" : destructive}
                />
                <Text
                  className={`text-sm font-semibold ${
                    user.isVerified ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {user.isVerified ? "Email đã được xác thực" : "Email chưa được xác thực"}
                </Text>
              </View>
            </View>

            <Button
              label="Lưu thay đổi"
              loading={updating}
              loadingLabel="Đang cập nhật..."
              onPress={submitProfile}
              leftIcon={<Ionicons name="save-outline" size={18} color="#fff" />}
            />
          </View>

          <View className="mt-4 gap-3 rounded-2xl border border-border bg-card p-4">
            <SettingsRow
              icon={isDark ? "moon" : "sunny"}
              title="Giao diện"
              subtitle={isDark ? "Đang dùng chế độ tối" : "Đang dùng chế độ sáng"}
              active={isDark}
              onPress={toggleTheme}
              primary={primary}
              muted={muted}
            />
            <SettingsRow
              icon="scan-outline"
              title="Đăng nhập bằng khuôn mặt"
              subtitle={`${faceLoginEnabled ? "Bật" : "Tắt"} - Nhấn để thay đổi`}
              active={faceLoginEnabled}
              loading={faceBusy}
              onPress={handleFaceToggle}
              primary={primary}
              muted={muted}
            />
          </View>

          <View className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            <View className="border-b border-border px-4 py-4">
              <View className="flex-row items-center gap-3">
                <Ionicons name="phone-portrait-outline" size={22} color={primary} />
                <View className="min-w-0 flex-1">
                  <Text className="text-lg font-bold text-foreground">Thiết bị đăng nhập</Text>
                  <Text className="mt-1 text-xs leading-4 text-muted-foreground">
                    Phiên đang hoạt động và lịch sử đăng nhập.
                  </Text>
                </View>
              </View>
            </View>
            <View className="p-4">
              {sessionsLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={primary} />
                </View>
              ) : sessions.length === 0 ? (
                <Text className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có phiên đăng nhập nào được lưu.
                </Text>
              ) : (
                <View className="gap-3">
                  {sessions.map((session) => (
                    <SessionCard
                      key={session.sessionId}
                      session={session}
                      revoking={revokingSessionId === session.sessionId}
                      disabled={revokingAnySession}
                      destructive={destructive}
                      onRevoke={() => void handleRevokeSession(session)}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>

          <Button
            label="Đăng xuất"
            variant="secondary"
            onPress={logout}
            leftIcon={<Ionicons name="log-out-outline" size={18} color={foreground} />}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PasswordModal
        visible={passwordOpen}
        password={password}
        loading={startingLiveness}
        foreground={foreground}
        muted={muted}
        onChangePassword={setPassword}
        onCancel={cancelFaceLoginEnablement}
        onConfirm={startFaceLoginEnablement}
      />

      <FaceLivenessWebViewModal
        visible={Boolean(livenessSessionId)}
        sessionId={livenessSessionId}
        onSuccess={completeFaceLoginEnablement}
        onCancel={cancelFaceLoginEnablement}
        onRetry={startFaceLoginEnablement}
        onError={(message) => toast.error(message)}
      />
    </SafeAreaView>
  );
}

function ProfileInput({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline = false,
  maxLength,
  keyboardType,
  footer,
  foreground,
  muted,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: "default" | "email-address" | "phone-pad";
  footer?: string;
  foreground: string;
  muted: string;
}) {
  return (
    <View>
      <View className="mb-2 flex-row items-center gap-2">
        <Ionicons name={icon} size={16} color={muted} />
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        editable={editable}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        className={`rounded-xl border border-border bg-muted/40 px-4 py-3 text-base text-foreground ${
          multiline ? "min-h-28" : ""
        } ${editable ? "" : "opacity-70"}`}
        style={{ color: foreground, textAlignVertical: multiline ? "top" : "center" }}
      />
      {footer ? <Text className="mt-1 text-xs text-muted-foreground">{footer}</Text> : null}
    </View>
  );
}

function InfoPill({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: string;
  dotClassName?: string;
}) {
  return (
    <View className="min-w-0 flex-1 rounded-xl bg-muted/40 p-3">
      <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
      <View className="mt-2 flex-row items-center gap-2">
        {dotClassName ? <View className={`size-2.5 rounded-full ${dotClassName}`} /> : null}
        <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  active,
  loading,
  onPress,
  primary,
  muted,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  active: boolean;
  loading?: boolean;
  onPress: () => void;
  primary: string;
  muted: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="flex-row items-center justify-between rounded-xl bg-muted/40 p-3 active:opacity-75 disabled:opacity-60"
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View className="size-10 items-center justify-center rounded-full bg-primary/10">
          <Ionicons name={icon} size={20} color={primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-foreground">{title}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View
        className={`h-7 w-12 justify-center rounded-full px-0.5 ${active ? "bg-primary" : "bg-muted"}`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={active ? "#fff" : muted} />
        ) : (
          <View
            className={`size-6 rounded-full bg-white shadow ${active ? "self-end" : "self-start"}`}
          />
        )}
      </View>
    </Pressable>
  );
}

function SessionCard({
  session,
  revoking,
  disabled,
  destructive,
  onRevoke,
}: {
  session: AuthSessionSummary;
  revoking: boolean;
  disabled: boolean;
  destructive: string;
  onRevoke: () => void;
}) {
  const status = getSessionStatus(session);
  const canRevoke = session.isActive && !session.isRevoked;

  return (
    <View className="rounded-xl border border-border bg-muted/30 p-3">
      <View className="flex-row items-start gap-3">
        <View className="size-10 items-center justify-center rounded-full bg-background">
          <Ionicons name="phone-portrait-outline" size={20} color="hsl(var(--primary) / 1)" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-foreground" numberOfLines={1}>
            {session.deviceInfo.browser || "Trình duyệt"} ·{" "}
            {session.deviceInfo.os || "Hệ điều hành"}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {session.isCurrent ? (
              <View className="rounded-full bg-primary/10 px-2 py-0.5">
                <Text className="text-xs font-semibold text-primary">Thiết bị này</Text>
              </View>
            ) : null}
            <View className={`rounded-full border px-2 py-0.5 ${status.className}`}>
              <Text className={`text-xs font-semibold ${status.textClassName}`}>
                {status.label}
              </Text>
            </View>
          </View>
          <Text className="mt-2 text-xs leading-5 text-muted-foreground">
            IP: {session.ipAddress || "—"}
            {"\n"}Vị trí: {formatSessionLocation(session.location)}
            {"\n"}Đăng nhập: {formatSessionDate(session.createdAt)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onRevoke}
        disabled={!canRevoke || disabled}
        className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 active:opacity-80 disabled:opacity-40"
      >
        {revoking ? (
          <ActivityIndicator size="small" color={destructive} />
        ) : (
          <Ionicons name="shield-outline" size={16} color={destructive} />
        )}
        <Text className="font-semibold text-destructive">Thu hồi truy cập</Text>
      </Pressable>
    </View>
  );
}

function PasswordModal({
  visible,
  password,
  loading,
  foreground,
  muted,
  onChangePassword,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  password: string;
  loading: boolean;
  foreground: string;
  muted: string;
  onChangePassword: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-black/45 px-5">
        <View className="rounded-2xl bg-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground">Xác thực mật khẩu</Text>
            <Pressable
              onPress={onCancel}
              className="size-9 items-center justify-center rounded-full bg-muted active:opacity-70"
            >
              <Ionicons name="close" size={20} color={foreground} />
            </Pressable>
          </View>
          <Text className="mb-4 text-sm leading-5 text-muted-foreground">
            Nhập mật khẩu của bạn trước khi bật đăng nhập bằng khuôn mặt.
          </Text>
          <TextInput
            value={password}
            onChangeText={onChangePassword}
            secureTextEntry
            placeholder="Nhập mật khẩu"
            placeholderTextColor={muted}
            className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-base text-foreground"
            style={{ color: foreground }}
            onSubmitEditing={onConfirm}
          />
          <View className="mt-5 flex-row gap-3">
            <Button label="Hủy" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button label="Tiếp tục" loading={loading} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
