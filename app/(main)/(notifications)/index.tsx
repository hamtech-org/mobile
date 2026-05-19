import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Bell } from "lucide-react-native";
import { EmptyState } from "@/components/common/EmptyState";
import { Loading } from "@/components/common/Loading";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { NotificationFilterChips } from "@/components/notifications/NotificationFilterChips";
import { NotificationSwipeableRow } from "@/components/notifications/NotificationSwipeableRow";
import { useAppDispatch } from "@/hooks/useAppStore";
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "@/store/api/notificationApi";
import {
  markAllInboxRead,
  markInboxRead,
  setInboxNotifications,
} from "@/store/slices/inboxNotificationSlice";
import { openNotificationFromItem } from "@/utils/notificationNavigation";
import { filterNotifications, type NotificationFilterChip } from "@/utils/notificationFilters";
import type { INotification } from "@/types/notification.types";

const PAGE_SIZE = 30;

export default function NotificationsScreen() {
  const dispatch = useAppDispatch();
  const [chip, setChip] = useState<NotificationFilterChip>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const { data, isLoading, isFetching, refetch } = useGetNotificationsQuery({ limit });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();

  const allItems = data?.items ?? [];

  const filtered = useMemo(
    () => filterNotifications(allItems, chip, hiddenIds),
    [allItems, chip, hiddenIds],
  );

  const chipCounts = useMemo(() => {
    const base = allItems.filter((n) => !hiddenIds.has(n.notificationId));
    return {
      all: base.length,
      unread: base.filter((n) => !n.isRead).length,
      message: base.filter((n) => ["message", "group_invite", "mention"].includes(n.type)).length,
      post: base.filter((n) =>
        ["post_reaction", "post_comment", "reel_new", "reel_comment", "comment_reply"].includes(
          n.type,
        ),
      ).length,
    };
  }, [allItems, hiddenIds]);

  const hasMore = allItems.length >= limit;

  const onOpen = useCallback(
    async (item: INotification) => {
      if (!item.isRead) {
        dispatch(markInboxRead(item.notificationId));
        try {
          await markRead(item.notificationId).unwrap();
        } catch {
          /* ignore */
        }
      }
      openNotificationFromItem(item);
    },
    [dispatch, markRead],
  );

  const onMarkOneRead = useCallback(
    async (item: INotification) => {
      if (item.isRead) return;
      dispatch(markInboxRead(item.notificationId));
      try {
        await markRead(item.notificationId).unwrap();
      } catch {
        /* ignore */
      }
    },
    [dispatch, markRead],
  );

  const onHide = useCallback((notificationId: string) => {
    setHiddenIds((prev) => new Set(prev).add(notificationId));
  }, []);

  const onMarkAll = useCallback(async () => {
    dispatch(markAllInboxRead());
    try {
      await markAllRead().unwrap();
      void refetch();
    } catch {
      /* ignore */
    }
  }, [dispatch, markAllRead, refetch]);

  const onRefresh = useCallback(() => {
    setLimit(PAGE_SIZE);
    void refetch().then((res) => {
      if (res.data?.items) dispatch(setInboxNotifications(res.data.items));
    });
  }, [dispatch, refetch]);

  const onEndReached = useCallback(() => {
    if (!hasMore || isFetching) return;
    setLimit((prev) => prev + PAGE_SIZE);
  }, [hasMore, isFetching]);

  if (isLoading && allItems.length === 0) {
    return <Loading fullScreen message="Đang tải thông báo..." />;
  }

  const emptyLabel =
    chip === "unread"
      ? "Không còn thông báo chưa đọc"
      : chip === "message"
        ? "Không có thông báo tin nhắn"
        : chip === "post"
          ? "Không có thông báo bài viết"
          : "Chưa có thông báo";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader
        title="Thông báo"
        onBack={() => router.back()}
        rightSlot={
          <Pressable
            onPress={() => void onMarkAll()}
            disabled={markingAll || chipCounts.unread === 0}
            className="px-2 py-1 active:opacity-70"
            accessibilityLabel="Đánh dấu tất cả đã đọc"
          >
            <Text
              className={`text-xs font-medium ${
                chipCounts.unread === 0 ? "text-muted-foreground" : "text-primary"
              }`}
            >
              Đọc hết
            </Text>
          </Pressable>
        }
      />

      <NotificationFilterChips active={chip} onChange={setChip} counts={chipCounts} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.notificationId}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 24,
        }}
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title={emptyLabel}
            description="Các hoạt động mới sẽ hiện ở đây."
          />
        }
        refreshing={isFetching && allItems.length > 0}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          isFetching && allItems.length > 0 ? (
            <View className="items-center py-4">
              <ActivityIndicator />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationSwipeableRow
            item={item}
            onPress={() => void onOpen(item)}
            onMarkRead={() => void onMarkOneRead(item)}
            onHide={() => onHide(item.notificationId)}
          />
        )}
      />
    </SafeAreaView>
  );
}
